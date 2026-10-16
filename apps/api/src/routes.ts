import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import {
  appInputSchema,
  defaultProxyOptions,
  hostInputSchema,
  proxyOptionsSchema,
  stripProxySecrets,
  type ProxyOptions,
  type StoredProxyOptions,
} from "@temis/shared";
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
import { removeLocalCustomCert, saveLocalCustomCert } from "./services/certs.js";

function persistProxyFromInput(
  slug: string,
  incoming: ProxyOptions,
  previous?: StoredProxyOptions,
): StoredProxyOptions {
  const merged: ProxyOptions = {
    ...defaultProxyOptions(),
    ...previous,
    ...incoming,
    https: true,
  };

  if (merged.certMode === "custom") {
    if (incoming.certPem?.trim() && incoming.keyPem?.trim()) {
      saveLocalCustomCert(slug, incoming.certPem, incoming.keyPem);
      merged.hasCustomCert = true;
    } else if (previous?.hasCustomCert || merged.hasCustomCert) {
      merged.hasCustomCert = true;
    } else {
      throw Object.assign(new Error("Certificado próprio exige fullchain PEM e chave privada"), {
        statusCode: 400,
      });
    }
  } else {
    merged.hasCustomCert = false;
    removeLocalCustomCert(slug);
  }

  return stripProxySecrets(merged);
}

function publicApp(row: typeof apps.$inferSelect) {
  const proxy = {
    ...defaultProxyOptions(),
    ...(JSON.parse(row.proxyJson) as StoredProxyOptions),
    https: true,
  };
  return {
    ...row,
    proxyJson: JSON.stringify(stripProxySecrets(proxy)),
  };
}

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
    return {
      hosts: metrics,
      apps: db.select().from(apps).all().map(publicApp),
    };
  });

  app.get("/api/apps", async () => db.select().from(apps).all().map(publicApp));

  app.post("/api/apps", async (req, reply) => {
    const body = appInputSchema.parse(req.body);
    const host = db.select().from(hosts).where(eq(hosts.id, body.hostId)).get();
    if (!host) return reply.code(400).send({ error: "Host inválido" });
    const slug = makeSlug(body.name);
    const now = Date.now();

    let storedProxy: StoredProxyOptions;
    try {
      storedProxy = persistProxyFromInput(slug, {
        ...defaultProxyOptions(),
        ...body.proxy,
        https: true,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: message });
    }

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
        proxyJson: JSON.stringify(storedProxy),
        status: "idle",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    return publicApp(row);
  });

  app.patch("/api/apps/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = appInputSchema.partial().parse(req.body);
    const current = db.select().from(apps).where(eq(apps.id, id)).get();
    if (!current) throw Object.assign(new Error("App não encontrado"), { statusCode: 404 });

    let proxyJson = current.proxyJson;
    if (body.proxy) {
      try {
        const previous = JSON.parse(current.proxyJson) as StoredProxyOptions;
        const stored = persistProxyFromInput(current.slug, body.proxy as ProxyOptions, previous);
        proxyJson = JSON.stringify(stored);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(400).send({ error: message });
      }
    }

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
        proxyJson,
        updatedAt: Date.now(),
      })
      .where(eq(apps.id, id))
      .run();
    const updated = db.select().from(apps).where(eq(apps.id, id)).get();
    return updated ? publicApp(updated) : null;
  });

  app.post("/api/apps/:id/proxy", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const incoming = proxyOptionsSchema.parse(req.body);
    const appRow = db.select().from(apps).where(eq(apps.id, id)).get();
    if (!appRow) throw Object.assign(new Error("App não encontrado"), { statusCode: 404 });

    let stored: StoredProxyOptions;
    try {
      const previous = JSON.parse(appRow.proxyJson) as StoredProxyOptions;
      stored = persistProxyFromInput(appRow.slug, incoming, previous);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: message });
    }

    db.update(apps)
      .set({ proxyJson: JSON.stringify(stored), updatedAt: Date.now() })
      .where(eq(apps.id, id))
      .run();

    if (appRow.publishedPort) {
      const host = db.select().from(hosts).where(eq(hosts.id, appRow.hostId)).get();
      if (host) {
        try {
          await applyNginx(
            host,
            appRow.slug,
            appRow.domain,
            appRow.publishedPort,
            stored,
            process.env.LETSENCRYPT_EMAIL ?? "admin@temis.local",
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          db.update(apps)
            .set({ lastError: message, updatedAt: Date.now() })
            .where(eq(apps.id, id))
            .run();
          return reply.code(500).send({ error: message });
        }
      }
    }
    return { ok: true, proxy: stored };
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
