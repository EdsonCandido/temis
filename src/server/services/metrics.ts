import fs from "node:fs";
import os from "node:os";
import { runOnHost, type HostRow } from "./executor.js";

export type HostMetrics = {
  hostname: string;
  cpuCount: number;
  load1: number;
  memUsedMb: number;
  memTotalMb: number;
  memPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  diskPercent: number;
  dockerOk: boolean;
  containers: ContainerMetric[];
};

export type ContainerMetric = {
  name: string;
  status: string;
  image: string;
  cpu: string;
  mem: string;
  memPercent: string;
  known: boolean;
  appName: string | null;
};

type RawContainer = Omit<ContainerMetric, "known" | "appName">;

type MemStats = {
  memUsedMb: number;
  memTotalMb: number;
  memPercent: number;
};

function memStats(totalMb: number, usedMb: number): MemStats {
  const memTotalMb = Math.max(0, Math.round(totalMb));
  const memUsedMb = Math.max(0, Math.round(usedMb));
  return {
    memTotalMb,
    memUsedMb,
    memPercent: memTotalMb ? Math.round((memUsedMb / memTotalMb) * 1000) / 10 : 0,
  };
}

function parseDf(line: string) {
  const parts = line.trim().split(/\s+/);
  const totalKb = Number(parts[1] ?? 0);
  const usedKb = Number(parts[2] ?? 0);
  return {
    diskTotalGb: Math.round((totalKb / 1024 / 1024) * 10) / 10,
    diskUsedGb: Math.round((usedKb / 1024 / 1024) * 10) / 10,
    diskPercent: totalKb ? Math.round((usedKb / totalKb) * 1000) / 10 : 0,
  };
}

/** Linux `free -m`: prefer `available` (exclui buff/cache reclaimable). */
function parseLinuxFree(stdout: string): MemStats | null {
  const lines = stdout.split("\n");
  const header = lines.find((l) => /total\s+used\s+free/i.test(l)) ?? "";
  const mem = lines.find((l) => /^\s*Mem:/.test(l));
  if (!mem) return null;

  const parts = mem.trim().split(/\s+/);
  const total = Number(parts[1] ?? 0);
  if (!total) return null;

  if (/available/i.test(header) && parts.length >= 7) {
    const available = Number(parts[6] ?? 0);
    return memStats(total, total - available);
  }

  return memStats(total, Number(parts[2] ?? 0));
}

/**
 * macOS `vm_stat`: aproxima Memory Used do Activity Monitor
 * (anonymous - purgeable + wired + compressor).
 */
function parseVmStat(stdout: string, totalBytes = os.totalmem()): MemStats | null {
  if (!/Pages free:/i.test(stdout)) return null;

  const pageSize = Number(/page size of (\d+) bytes/i.exec(stdout)?.[1] ?? 4096);
  const pages = (label: string) => {
    const m = new RegExp(`${label}:\\s+(\\d+)`, "i").exec(stdout);
    return Number(m?.[1] ?? 0);
  };

  const anonymous = pages("Anonymous pages");
  const purgeable = pages("Pages purgeable");
  const wired = pages("Pages wired down");
  const compressed = pages("Pages occupied by compressor");

  const usedBytes = (Math.max(0, anonymous - purgeable) + wired + compressed) * pageSize;
  return memStats(totalBytes / 1024 / 1024, usedBytes / 1024 / 1024);
}

function parseMeminfo(): MemStats | null {
  try {
    const text = fs.readFileSync("/proc/meminfo", "utf8");
    const totalKb = Number(/MemTotal:\s+(\d+)/i.exec(text)?.[1] ?? 0);
    const availableKb = Number(/MemAvailable:\s+(\d+)/i.exec(text)?.[1] ?? 0);
    if (!totalKb || !availableKb) return null;
    return memStats(totalKb / 1024, (totalKb - availableKb) / 1024);
  } catch {
    return null;
  }
}

function fallbackOsMem(): MemStats {
  const fromProc = parseMeminfo();
  if (fromProc) return fromProc;

  const total = os.totalmem();
  const free = os.freemem();
  return memStats(total / 1024 / 1024, (total - free) / 1024 / 1024);
}

export function parseMem(stdout: string): MemStats {
  return parseLinuxFree(stdout) ?? parseVmStat(stdout) ?? fallbackOsMem();
}

function pipeFields(line: string, expected: number): string[] {
  const parts = line.split("|");
  if (parts.length <= expected) return parts;
  return [...parts.slice(0, expected - 1), parts.slice(expected - 1).join("|")];
}

export function normalizeContainerName(name: string): string {
  return name.trim().replace(/^\//, "").split(",")[0]?.trim() ?? "";
}

function emptyContainer(name: string): RawContainer {
  return { name, status: "", image: "", cpu: "", mem: "", memPercent: "" };
}

function parseDockerPsLine(line: string): RawContainer | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.includes("DOCKER_") || trimmed.startsWith("---")) return null;

  if (trimmed.startsWith("{")) {
    try {
      const row = JSON.parse(trimmed) as Record<string, unknown>;
      const name = normalizeContainerName(String(row.Names ?? row.Name ?? ""));
      if (!name) return null;
      return {
        ...emptyContainer(name),
        status: String(row.State || row.Status || "").trim(),
        image: String(row.Image ?? "").trim(),
      };
    } catch {
      return null;
    }
  }

  if (!trimmed.includes("|")) return null;
  const rawParts = trimmed.split("|");
  const expected = rawParts.length >= 4 ? 4 : 3;
  const parts = pipeFields(trimmed, expected);
  const name = normalizeContainerName(parts[0] ?? "");
  if (!name) return null;
  if (expected === 4) {
    return {
      ...emptyContainer(name),
      status: (parts[1] || parts[2] || "").trim(),
      image: (parts[3] ?? "").trim(),
    };
  }
  return {
    ...emptyContainer(name),
    status: (parts[1] ?? "").trim(),
    image: (parts[2] ?? "").trim(),
  };
}

export function parseDockerInventory(dockerBlock: string): RawContainer[] {
  const psBlock = dockerBlock.includes("---PS---")
    ? (dockerBlock.split("---PS---")[1]?.split("---STATS---")[0] ?? "")
    : "";
  const statsBlock = dockerBlock.includes("---STATS---")
    ? (dockerBlock.split("---STATS---")[1] ?? "")
    : dockerBlock;

  const byName = new Map<string, RawContainer>();

  for (const line of psBlock.split("\n")) {
    const parsed = parseDockerPsLine(line);
    if (!parsed) continue;
    byName.set(parsed.name, parsed);
  }

  for (const line of statsBlock.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.includes("|") || trimmed.includes("DOCKER_") || trimmed.startsWith("---")) continue;
    const [nameRaw, cpu, memUsage, memPercent] = pipeFields(trimmed, 4);
    const name = normalizeContainerName(nameRaw ?? "");
    if (!name) continue;
    const prev = byName.get(name);
    byName.set(name, {
      name,
      status: prev?.status ?? "",
      image: prev?.image ?? "",
      cpu: (cpu ?? "").trim(),
      mem: (memUsage ?? "").trim(),
      memPercent: (memPercent ?? "").trim(),
    });
  }

  return [...byName.values()];
}

export function markKnownContainers(
  containers: RawContainer[],
  knownApps: Array<{ name: string; slug: string; containerName: string | null }>,
): ContainerMetric[] {
  const byName = new Map<string, string>();
  for (const app of knownApps) {
    if (app.containerName) byName.set(normalizeContainerName(app.containerName), app.name);
    byName.set(`temis-${app.slug}`, app.name);
  }
  return containers.map((c) => {
    const key = normalizeContainerName(c.name);
    return {
      ...c,
      name: key,
      known: byName.has(key),
      appName: byName.get(key) ?? null,
    };
  });
}

export async function collectHostMetrics(host: HostRow): Promise<HostMetrics> {
  const script = [
    "echo HOSTNAME=$(hostname)",
    "echo CPU=$(nproc 2>/dev/null || sysctl -n hw.ncpu)",
    "echo LOAD=$(uptime)",
    "free -m 2>/dev/null || vm_stat",
    "echo '---DF---'",
    "df -k / | tail -1",
    "echo '---DOCKER---'",
    "docker info >/dev/null 2>&1 && echo DOCKER_OK || echo DOCKER_FAIL",
    "echo '---PS---'",
    'docker ps -a --no-trunc --format "{{json .}}" 2>/dev/null || docker ps -a --format "{{.Names}}|{{.Status}}|{{.Image}}" 2>/dev/null || true',
    "echo '---STATS---'",
    'docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}" 2>/dev/null || true',
  ].join("; ");

  const r = await runOnHost(host, script);
  const out = `${r.stdout}\n${r.stderr}`;
  const hostname = /HOSTNAME=(\S+)/.exec(out)?.[1] ?? host.name;
  const cpuCount = Number(/CPU=(\d+)/.exec(out)?.[1] ?? os.cpus().length);
  const loadMatch = /load averages?: ([\d.]+)/i.exec(out) || /load average: ([\d.]+)/i.exec(out);
  const load1 = Number(loadMatch?.[1] ?? os.loadavg()[0] ?? 0);
  const dfLine = out.split("---DF---")[1]?.split("\n").find((l) => /\d/.test(l)) ?? "";
  const disk = parseDf(dfLine);
  const mem = parseMem(out);
  const dockerOk = out.includes("DOCKER_OK");
  const dockerBlock = out.split("---DOCKER---")[1] ?? "";
  const containers = markKnownContainers(parseDockerInventory(dockerBlock), []);

  return {
    hostname,
    cpuCount,
    load1,
    dockerOk,
    containers,
    ...mem,
    ...disk,
  };
}
