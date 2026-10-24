import { runOnHost, type HostRow } from "../../services/executor.js";

export const SIGNALS = ["TERM", "KILL"] as const;
export type ProcSignal = (typeof SIGNALS)[number];

export type ProcessRow = {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  rssKb: number;
  elapsed: string;
  stat: string;
  command: string;
};

export function assertPid(pid: number) {
  if (!Number.isInteger(pid) || pid < 2) {
    throw Object.assign(new Error("PID inválido"), { statusCode: 400 });
  }
}

export function parsePs(stdout: string): ProcessRow[] {
  const rows: ProcessRow[] = [];
  for (const line of stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || /^pid\b/i.test(trimmed)) continue;
    const m = /^(\d+)\s+(\S+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+(\S+)\s+(\S+)\s+(.*)$/.exec(trimmed);
    if (!m) continue;
    rows.push({
      pid: Number(m[1]),
      user: m[2],
      cpu: Number(m[3]),
      mem: Number(m[4]),
      rssKb: Number(m[5]),
      elapsed: m[6],
      stat: m[7],
      command: m[8].trim(),
    });
  }
  rows.sort((a, b) => b.cpu - a.cpu);
  return rows.slice(0, 250);
}

export async function listProcesses(host: HostRow) {
  const cmd =
    "ps -axo pid=,user=,pcpu=,pmem=,rss=,etime=,stat=,comm= 2>/dev/null || ps -eo pid,user,pcpu,pmem,rss,etime,stat,comm --sort=-pcpu";
  const r = await runOnHost(host, cmd);
  if (r.code !== 0 && !r.stdout.trim()) {
    throw Object.assign(new Error(r.stderr.trim() || "ps falhou neste host"), { statusCode: 500 });
  }
  return { processes: parsePs(r.stdout) };
}

export async function signalProcess(host: HostRow, pid: number, signal: ProcSignal) {
  assertPid(pid);
  const cmd = `kill -s ${signal} ${pid} || sudo -n kill -s ${signal} ${pid}`;
  const r = await runOnHost(host, cmd);
  if (r.code !== 0) {
    throw Object.assign(new Error(r.stderr.trim() || r.stdout.trim() || `kill ${signal} falhou`), {
      statusCode: 500,
    });
  }
  return { ok: true, pid, signal };
}
