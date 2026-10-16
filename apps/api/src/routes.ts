import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { appInputSchema, defaultProxyOptions, hostInputSchema, proxyOptionsSchema } from "@temis/shared";
import { db, apps, deployments, hosts } from "./db/index.js";
import { requireUser } from "./auth.js";
import { pingDocker } from "./services/executor.js";
import { collectHostMetrics } from "./services/metrics.js";
import {
  appLogs,
  deployApp,
  destroyApp,
  makeSlug,
  restartApp,
  stopApp,
} from "./services/deploy.js";
import { applyNginx } from "./services/nginx.js";

export async function registerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", async (req) => {
    if (req.url.startsWith("/api/auth")) return;
    if (!req.url.startsWith("/api/")) return;
    await requireUser(req);
  });

  app.get("/api/hosts", async () => db.select().from(hosts).all());

  app.post("/api/hosts", async (req, reply) => {
    const body = hostInputSchema.parse(req.body);
    if (body.kind === "ssh" && (!body.sshHost || !body.sshUser)) {
      return reply.code(400).send({ error: "SSH exige host e usuário" });
    }
    const row = db
      .insert(hosts)
      .values({
        name: body.name,
        kind: body.kind,
        sshHost: body.sshHost ?? null,
        sshPort: body.sshPort ?? 22,
        sshUser: body.sshUser ?? null,
        sshKeyPath: body.sshKeyPath ?? null,
        createdAt: Date.now(),
      })
      .returning()
      .get();
    return row;
  });

  app.delete("/api/hosts/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const used = db.select().from(apps).where(eq(apps.hostId, id)).get();
    if (used) return reply.code(409).send({ error: "Host ainda tem aplicações" });
    db.delete(hosts).where(eq(hosts.id, id)).run();
    return { ok: true };
  });

  app.post("/api/hosts/:id/test", async (req) => {
    const id = Number((req.params as { id: string }).id);
    const host = db.select().from(hosts).where(eq(hosts.id, id)).get();
    if (!host) throw Object.assign(new Error("Host não encontrado"), { statusCode: 404 });
    const version = await pingDocker(host);
    return { ok: true, docker: version };
  });

  app.get("/api/hosts/:id/metrics", async (req) => {
    const id = Number((req.params as { id: string }).id);
    const host = db.select().from(hosts).where(eq(hosts.id, id)).get();
    if (!host) throw Object.assign(new Error("Host não encontrado"), { statusCode: 404 });
    return collectHostMetrics(host);
  });

  app.get("/api/overview", async () => {
    const allHosts = db.select().from(hosts).all();
    const metrics = await Promise.all(
      allHosts.map(async (h) => {
        try {
          return { host: h, metrics: await collectHostMetrics(h) };
        } catch (err) {
          return { host: h, error: err instanceof Error ? err.message : String(err) };
        }
      }),
    );
    return { hosts: metrics, apps: db.select().from(apps).all() };
  });

  app.get("/api/apps", async () => db.select().from(apps).all());

  app.post("/api/apps", async (req, reply) => {
    const body = appInputSchema.parse(req.body);
    const host = db.select().from(hosts).where(eq(hosts.id, body.hostId)).get();
    if (!host) return reply.code(400).send({ error: "Host inválido" });
    const slug = makeSlug(body.name);
    const now = Date.now();
    const row = db
      .insert(apps)
      .values({
        hostId: body.hostId,
        name: body.name,
        slug,
        domain: body.domain,
        sourceType: body.sourceType,
        sourceUrl: body.sourceUrl,
        githubRef: body.githubRef ?? "main",
        dockerfilePath: body.dockerfilePath ?? "Dockerfile",
        internalPort: body.internalPort,
        envText: body.envText ?? "",
        proxyJson: JSON.stringify({ ...defaultProxyOptions(), ...body.proxy }),
        status: "idle",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    return row;
  });

  app.patch("/api/apps/:id", async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = appInputSchema.partial().parse(req.body);
    const current = db.select().from(apps).where(eq(apps.id, id)).get();
    if (!current) throw Object.assign(new Error("App não encontrado"), { statusCode: 404 });
    const proxy = body.proxy
      ? JSON.stringify({ ...JSON.parse(current.proxyJson), ...body.proxy })
      : current.proxyJson;
    db.update(apps)
      .set({
        name: body.name ?? current.name,
        domain: body.domain ?? current.domain,
        sourceType: body.sourceType ?? current.sourceType,
        sourceUrl: body.sourceUrl ?? current.sourceUrl,
        githubRef: body.githubRef ?? current.githubRef,
        dockerfilePath: body.dockerfilePath ?? current.dockerfilePath,
        internalPort: body.internalPort ?? current.internalPort,
        envText: body.envText ?? current.envText,
        proxyJson: proxy,
        updatedAt: Date.now(),
      })
      .where(eq(apps.id, id))
      .run();
    return db.select().from(apps).where(eq(apps.id, id)).get();
  });

  app.post("/api/apps/:id/proxy", async (req) => {
    const id = Number((req.params as { id: string }).id);
    const proxy = proxyOptionsSchema.parse(req.body);
    const appRow = db.select().from(apps).where(eq(apps.id, id)).get();
    if (!appRow) throw Object.assign(new Error("App não encontrado"), { statusCode: 404 });
    db.update(apps)
      .set({ proxyJson: JSON.stringify(proxy), updatedAt: Date.now() })
      .where(eq(apps.id, id))
      .run();
    if (appRow.publishedPort) {
      const host = db.select().from(hosts).where(eq(hosts.id, appRow.hostId)).get();
      if (host) {
        await applyNginx(
          host,
          appRow.slug,
          appRow.domain,
          appRow.publishedPort,
          proxy,
          process.env.LETSENCRYPT_EMAIL ?? "admin@temis.local",
        );
      }
    }
    return { ok: true, proxy };
  });

  app.post("/api/apps/:id/deploy", async (req) => {
    const id = Number((req.params as { id: string }).id);
    return deployApp(id);
  });

  app.post("/api/apps/:id/stop", async (req) => {
    const id = Number((req.params as { id: string }).id);
    await stopApp(id);
    return { ok: true };
  });

  app.post("/api/apps/:id/restart", async (req) => {
    const id = Number((req.params as { id: string }).id);
    await restartApp(id);
    return { ok: true };
  });

  app.get("/api/apps/:id/logs", async (req) => {
    const id = Number((req.params as { id: string }).id);
    const text = await appLogs(id);
    const history = db.select().from(deployments).where(eq(deployments.appId, id)).all();
    return { container: text, deployments: history };
  });

  app.delete("/api/apps/:id", async (req) => {
    const id = Number((req.params as { id: string }).id);
    await destroyApp(id);
    return { ok: true };
  });
}
