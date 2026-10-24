import { eq } from "drizzle-orm";
import { db, apps } from "../../db/index.js";
import { collectHostMetrics } from "../../services/metrics.js";
import { runOnHost, type HostRow } from "../../services/executor.js";

export type MonitorLevel = "ok" | "warn" | "down";

export type Monitor = {
  id: string;
  name: string;
  kind: "host" | "load" | "memory" | "disk" | "docker" | "app";
  level: MonitorLevel;
  detail: string;
};

function levelFromPercent(percent: number, warnAt: number, downAt: number): MonitorLevel {
  if (percent >= downAt) return "down";
  if (percent >= warnAt) return "warn";
  return "ok";
}

export async function collectStatus(host: HostRow): Promise<{
  hostName: string;
  checkedAt: number;
  monitors: Monitor[];
}> {
  const monitors: Monitor[] = [];

  try {
    const metrics = await collectHostMetrics(host);
    monitors.push({
      id: "host",
      name: "Host",
      kind: "host",
      level: "ok",
      detail: metrics.hostname,
    });

    const loadLevel =
      metrics.cpuCount > 0 && metrics.load1 > metrics.cpuCount * 1.5
        ? "down"
        : metrics.cpuCount > 0 && metrics.load1 > metrics.cpuCount
          ? "warn"
          : "ok";
    monitors.push({
      id: "load",
      name: "Load",
      kind: "load",
      level: loadLevel,
      detail: `${metrics.load1.toFixed(2)} em ${metrics.cpuCount} CPU`,
    });

    monitors.push({
      id: "memory",
      name: "Memória",
      kind: "memory",
      level: levelFromPercent(metrics.memPercent, 80, 95),
      detail: `${metrics.memUsedMb} / ${metrics.memTotalMb} MB (${metrics.memPercent}%)`,
    });

    monitors.push({
      id: "disk",
      name: "Disco /",
      kind: "disk",
      level: levelFromPercent(metrics.diskPercent, 80, 95),
      detail: `${metrics.diskUsedGb} / ${metrics.diskTotalGb} GB (${metrics.diskPercent}%)`,
    });

    monitors.push({
      id: "docker",
      name: "Docker",
      kind: "docker",
      level: metrics.dockerOk ? "ok" : "down",
      detail: metrics.dockerOk ? "daemon responde" : "daemon indisponível",
    });

    const hostApps = db.select().from(apps).where(eq(apps.hostId, host.id)).all();
    for (const app of hostApps) {
      const running = app.status === "running";
      let detail = running ? `status ${app.status}` : `status ${app.status}`;
      if (app.containerName && running) {
        const probe = await runOnHost(
          host,
          `docker inspect -f '{{.State.Running}}' ${JSON.stringify(app.containerName)} 2>/dev/null || echo false`,
        );
        const up = probe.stdout.trim() === "true";
        monitors.push({
          id: `app-${app.id}`,
          name: app.name,
          kind: "app",
          level: up ? "ok" : "down",
          detail: up ? `${app.domain} · container no ar` : `${app.domain} · container parado`,
        });
        continue;
      }
      monitors.push({
        id: `app-${app.id}`,
        name: app.name,
        kind: "app",
        level: running ? "ok" : "down",
        detail: `${app.domain} · ${detail}`,
      });
    }
  } catch (err) {
    monitors.push({
      id: "host",
      name: "Host",
      kind: "host",
      level: "down",
      detail: err instanceof Error ? err.message : String(err),
    });
  }

  return { hostName: host.name, checkedAt: Date.now(), monitors };
}
