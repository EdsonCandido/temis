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
  containers: Array<{
    name: string;
    status: string;
    cpu: string;
    mem: string;
    memPercent: string;
  }>;
};

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

function parseFree(stdout: string) {
  const mem = stdout.split("\n").find((l) => l.startsWith("Mem:"));
  if (!mem) {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return {
      memTotalMb: Math.round(total / 1024 / 1024),
      memUsedMb: Math.round(used / 1024 / 1024),
      memPercent: Math.round((used / total) * 1000) / 10,
    };
  }
  const parts = mem.trim().split(/\s+/);
  const total = Number(parts[1] ?? 0);
  const used = Number(parts[2] ?? 0);
  return {
    memTotalMb: Math.round(total / 1024),
    memUsedMb: Math.round(used / 1024),
    memPercent: total ? Math.round((used / total) * 1000) / 10 : 0,
  };
}

function localOsMem() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;
  return {
    memTotalMb: Math.round(total / 1024 / 1024),
    memUsedMb: Math.round(used / 1024 / 1024),
    memPercent: Math.round((used / total) * 1000) / 10,
  };
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
    "docker stats --no-stream --format '{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}|{{.MemPerc}}' 2>/dev/null || true",
  ].join("; ");

  const r = await runOnHost(host, script);
  const out = `${r.stdout}\n${r.stderr}`;
  const hostname = /HOSTNAME=(\S+)/.exec(out)?.[1] ?? host.name;
  const cpuCount = Number(/CPU=(\d+)/.exec(out)?.[1] ?? os.cpus().length);
  const loadMatch = /load averages?: ([\d.]+)/i.exec(out) || /load average: ([\d.]+)/i.exec(out);
  const load1 = Number(loadMatch?.[1] ?? os.loadavg()[0] ?? 0);
  const dfLine = out.split("---DF---")[1]?.split("\n").find((l) => /\d/.test(l)) ?? "";
  const disk = parseDf(dfLine);
  const mem = host.kind === "local" ? localOsMem() : parseFree(out);
  const dockerOk = out.includes("DOCKER_OK");
  const dockerBlock = out.split("---DOCKER---")[1] ?? "";
  const containers = dockerBlock
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.includes("|") && !l.includes("DOCKER_"))
    .map((l) => {
      const [name, cpu, memUsage, memPercent] = l.split("|");
      return {
        name: name ?? "",
        cpu: cpu ?? "",
        mem: memUsage ?? "",
        memPercent: memPercent ?? "",
        status: "",
      };
    });

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
