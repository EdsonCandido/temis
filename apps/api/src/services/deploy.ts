import { eq } from "drizzle-orm";
import { defaultProxyOptions, type ProxyOptions } from "@temis/shared";
import { db, apps, deployments, hosts } from "../db/index.js";
import { assertOk, pingDocker, runOnHost, type HostRow } from "./executor.js";
import { applyNginx, removeNginx } from "./nginx.js";

function slugify(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function parseEnv(envText: string) {
  return envText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#") && l.includes("="));
}

function githubCloneUrl(url: string) {
  if (url.endsWith(".git")) return url;
  if (url.includes("github.com")) return url.replace(/\/$/, "") + ".git";
  return url;
}

export function makeSlug(name: string) {
  return slugify(name);
}

export async function deployApp(appId: number) {
  const app = db.select().from(apps).where(eq(apps.id, appId)).get();
  if (!app) throw new Error("App não encontrado");
  const host = db.select().from(hosts).where(eq(hosts.id, app.hostId)).get();
  if (!host) throw new Error("Host não encontrado");

  const dep = db
    .insert(deployments)
    .values({ appId, status: "running", log: "", createdAt: Date.now() })
    .returning()
    .get();

  const logs: string[] = [];
  const log = (line: string) => {
    logs.push(line);
    db.update(deployments)
      .set({ log: logs.join("\n") })
      .where(eq(deployments.id, dep.id))
      .run();
  };

  db.update(apps)
    .set({ status: "deploying", lastError: null, updatedAt: Date.now() })
    .where(eq(apps.id, appId))
    .run();

  try {
    log(`host=${host.name} kind=${host.kind}`);
    const dockerVersion = await pingDocker(host);
    log(`docker ${dockerVersion}`);

    const container = `temis-${app.slug}`;
    const imageTag = `temis/${app.slug}:latest`;
    const work = `/opt/temis/apps/${app.slug}`;
    const envFlags = parseEnv(app.envText)
      .map((e) => `-e ${JSON.stringify(e)}`)
      .join(" ")
      .trim();

    await runOnHost(host, `docker rm -f ${container} >/dev/null 2>&1 || true`);

    if (app.sourceType === "github") {
      const repo = githubCloneUrl(app.sourceUrl);
      const ref = app.githubRef || "main";
      const df = app.dockerfilePath || "Dockerfile";
      log(`clone ${repo} @ ${ref}`);
      const clone = await runOnHost(
        host,
        `mkdir -p /opt/temis/apps && rm -rf ${work} && git clone --depth 1 --branch ${JSON.stringify(ref)} ${JSON.stringify(repo)} ${work}`,
      );
      if (clone.code !== 0) {
        const fallback = await runOnHost(
          host,
          `git clone --depth 1 ${JSON.stringify(repo)} ${work} && cd ${work} && git checkout ${JSON.stringify(ref)}`,
        );
        await assertOk(fallback, "git clone");
        log(fallback.stdout || fallback.stderr);
      } else {
        log(clone.stdout || "clone ok");
      }
      log(`build ${imageTag} (${df})`);
      const build = await runOnHost(
        host,
        `docker build -t ${imageTag} -f ${work}/${df} ${work}`,
      );
      await assertOk(build, "docker build");
      log(build.stdout.split("\n").slice(-8).join("\n"));
    } else {
      log(`pull ${app.sourceUrl}`);
      const pull = await runOnHost(host, `docker pull ${JSON.stringify(app.sourceUrl)}`);
      await assertOk(pull, "docker pull");
      log(pull.stdout.split("\n").slice(-5).join("\n"));
    }

    const image = app.sourceType === "github" ? imageTag : app.sourceUrl;
    log(`run ${container} <- ${image}:${app.internalPort}`);
    const run = await runOnHost(
      host,
      `docker run -d --name ${container} --restart unless-stopped -p 127.0.0.1::${app.internalPort} ${envFlags} ${JSON.stringify(image)}`,
    );
    await assertOk(run, "docker run");

    const portProbe = await runOnHost(
      host,
      `docker port ${container} ${app.internalPort}/tcp | awk -F: '{print $NF}'`,
    );
    await assertOk(portProbe, "docker port");
    const publishedPort = Number(portProbe.stdout.trim());
    if (!publishedPort) throw new Error("Não foi possível descobrir a porta publicada");
    log(`porta publicada ${publishedPort}`);

    const proxy = JSON.parse(app.proxyJson) as ProxyOptions;
    const email = process.env.LETSENCRYPT_EMAIL ?? "admin@temis.local";
    log(`nginx domínio=${app.domain} https=${proxy.https}`);
    try {
      await applyNginx(host, app.slug, app.domain, publishedPort, { ...defaultProxyOptions(), ...proxy }, email);
      log("nginx aplicado");
    } catch (err) {
      log(`nginx aviso: ${err instanceof Error ? err.message : String(err)}`);
      log("app no ar na porta local; ajuste permissão sudo/nginx no host se precisar HTTPS público");
    }

    db.update(apps)
      .set({
        status: "running",
        containerName: container,
        publishedPort,
        lastError: null,
        updatedAt: Date.now(),
      })
      .where(eq(apps.id, appId))
      .run();
    db.update(deployments)
      .set({ status: "ok", log: logs.join("\n") })
      .where(eq(deployments.id, dep.id))
      .run();
    return { ok: true, logs: logs.join("\n") };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log(`ERRO ${message}`);
    db.update(apps)
      .set({ status: "error", lastError: message, updatedAt: Date.now() })
      .where(eq(apps.id, appId))
      .run();
    db.update(deployments)
      .set({ status: "error", log: logs.join("\n") })
      .where(eq(deployments.id, dep.id))
      .run();
    throw err;
  }
}

export async function stopApp(appId: number) {
  const app = db.select().from(apps).where(eq(apps.id, appId)).get();
  if (!app?.containerName) return;
  const host = db.select().from(hosts).where(eq(hosts.id, app.hostId)).get();
  if (!host) return;
  await runOnHost(host, `docker stop ${app.containerName} || true`);
  db.update(apps).set({ status: "stopped", updatedAt: Date.now() }).where(eq(apps.id, appId)).run();
}

export async function restartApp(appId: number) {
  const app = db.select().from(apps).where(eq(apps.id, appId)).get();
  if (!app?.containerName) throw new Error("App sem container");
  const host = db.select().from(hosts).where(eq(hosts.id, app.hostId)).get();
  if (!host) throw new Error("Host não encontrado");
  const r = await runOnHost(host, `docker restart ${app.containerName}`);
  await assertOk(r, "restart");
  db.update(apps).set({ status: "running", updatedAt: Date.now() }).where(eq(apps.id, appId)).run();
}

export async function appLogs(appId: number, tail = 200) {
  const app = db.select().from(apps).where(eq(apps.id, appId)).get();
  if (!app?.containerName) return "";
  const host = db.select().from(hosts).where(eq(hosts.id, app.hostId)).get();
  if (!host) return "";
  const r = await runOnHost(host, `docker logs --tail ${tail} ${app.containerName} 2>&1`);
  return r.stdout || r.stderr;
}

export async function destroyApp(appId: number) {
  const app = db.select().from(apps).where(eq(apps.id, appId)).get();
  if (!app) return;
  const host = db.select().from(hosts).where(eq(hosts.id, app.hostId)).get();
  if (host) {
    if (app.containerName) await runOnHost(host, `docker rm -f ${app.containerName} || true`);
    await removeNginx(host, app.slug);
  }
  db.delete(apps).where(eq(apps.id, appId)).run();
}

export function requireHost(id: number): HostRow {
  const host = db.select().from(hosts).where(eq(hosts.id, id)).get();
  if (!host) throw new Error("Host não encontrado");
  return host;
}
