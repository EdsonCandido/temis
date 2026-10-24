import { runOnHost, type HostRow } from "../../services/executor.js";
import { fail, shQuote } from "../sh.js";
import {
  analyzeOpenRules,
  detectBasics,
  parseIptablesSave,
  parseSsListen,
  parseSsStats,
  type BasicsStatus,
  type Finding,
  type Traffic,
} from "./analyze.js";

export const BASIC_IDS = ["lo", "established", "ssh", "http", "https", "invalid"] as const;
export type BasicId = (typeof BASIC_IDS)[number];

export const CHAINS = ["INPUT", "FORWARD", "OUTPUT"] as const;
export const PROTOS = ["tcp", "udp", "icmp", "all"] as const;
export const TARGETS = ["ACCEPT", "DROP", "REJECT"] as const;

export type FirewallChainName = (typeof CHAINS)[number];
export type FirewallProto = (typeof PROTOS)[number];
export type FirewallTarget = (typeof TARGETS)[number];

const CHAIN_RE = /^(INPUT|FORWARD|OUTPUT)$/;
const CIDR_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\/(?:3[0-2]|[12]?\d))?$/;

export type FirewallRule = {
  num: number;
  pkts: string;
  bytes: string;
  target: string;
  proto: string;
  inIface: string;
  outIface: string;
  source: string;
  destination: string;
  extra: string;
};

export type FirewallChain = {
  name: string;
  policy: string;
  rules: FirewallRule[];
};

export function assertChain(chain: string): asserts chain is FirewallChainName {
  if (!CHAIN_RE.test(chain)) fail("Chain inválida", 400);
}

export function assertProto(proto: string): asserts proto is FirewallProto {
  if (!(PROTOS as readonly string[]).includes(proto)) fail("Protocolo inválido", 400);
}

export function assertTarget(target: string): asserts target is FirewallTarget {
  if (!(TARGETS as readonly string[]).includes(target)) fail("Alvo inválido", 400);
}

export function assertPort(port: number | undefined) {
  if (port === undefined) return;
  if (!Number.isInteger(port) || port < 1 || port > 65535) fail("Porta inválida", 400);
}

export function assertSource(source: string | undefined) {
  if (!source) return;
  if (!CIDR_RE.test(source)) fail("Origem IPv4/CIDR inválida", 400);
}

export function parseIptablesList(stdout: string): { available: boolean; chains: FirewallChain[] } {
  if (stdout.includes("NO_IPTABLES")) return { available: false, chains: [] };

  const chains: FirewallChain[] = [];
  let current: FirewallChain | null = null;

  for (const raw of stdout.split("\n")) {
    const line = raw.trimEnd();
    const head = /^Chain\s+(\S+)\s+\(policy\s+(\S+)/i.exec(line.trim());
    if (head) {
      current = { name: head[1], policy: head[2], rules: [] };
      chains.push(current);
      continue;
    }
    if (!current) continue;
    const trimmed = line.trim();
    if (!trimmed || /^num\b/i.test(trimmed) || /^pkts\b/i.test(trimmed)) continue;
    const m =
      /^(\d+)\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s+\S+\s+(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\s*(.*)$/.exec(
        trimmed,
      );
    if (!m) continue;
    current.rules.push({
      num: Number(m[1]),
      pkts: m[2],
      bytes: m[3],
      target: m[4],
      proto: m[5],
      inIface: m[6],
      outIface: m[7],
      source: m[8],
      destination: m[9],
      extra: m[10].trim(),
    });
  }

  return { available: true, chains: chains.filter((c) => CHAINS.includes(c.name as FirewallChainName)) };
}

export async function listFirewall(host: HostRow) {
  const script = [
    "if ! command -v iptables >/dev/null 2>&1; then echo NO_IPTABLES; exit 0; fi",
    "echo '---LIST---'",
    "iptables -L -n -v --line-numbers 2>/dev/null || sudo -n iptables -L -n -v --line-numbers",
    "echo '---SAVE---'",
    "iptables-save -c 2>/dev/null || sudo -n iptables-save -c 2>/dev/null || true",
    "echo '---LISTEN---'",
    "ss -tulnH 2>/dev/null || ss -tuln 2>/dev/null || netstat -lntu 2>/dev/null || true",
    "echo '---SSSTATS---'",
    "ss -s 2>/dev/null || true",
  ].join("\n");
  const r = await runOnHost(host, script);
  const out = `${r.stdout}\n${r.stderr}`;
  const listBlock = out.split("---LIST---")[1]?.split("---SAVE---")[0] ?? out;
  const parsed = parseIptablesList(listBlock);
  if (!parsed.available) {
    return {
      available: false,
      chains: [] as FirewallChain[],
      basics: detectBasics([]),
      findings: [] as Finding[],
      traffic: { tcpEstab: 0, timeWait: 0, listeners: [] } as Traffic,
      message: "iptables não existe neste host",
    };
  }
  if (r.code !== 0 && parsed.chains.length === 0) {
    fail(r.stderr.trim() || r.stdout.trim() || "iptables -L falhou", 500);
  }
  const save = parseIptablesSave(out.split("---SAVE---")[1]?.split("---LISTEN---")[0] ?? "");
  const listeners = parseSsListen(out.split("---LISTEN---")[1]?.split("---SSSTATS---")[0] ?? "");
  const stats = parseSsStats(out.split("---SSSTATS---")[1] ?? "");
  const basics: BasicsStatus = detectBasics(save);
  const findings = analyzeOpenRules(parsed.chains, save, listeners);
  const traffic: Traffic = { ...stats, listeners };
  return { available: true, chains: parsed.chains, basics, findings, traffic, message: null as string | null };
}

function basicArgs(id: BasicId, sshPort: number): string[] {
  if (id === "lo") return ["-i", "lo", "-j", "ACCEPT"];
  if (id === "established") return ["-m", "conntrack", "--ctstate", "ESTABLISHED,RELATED", "-j", "ACCEPT"];
  if (id === "invalid") return ["-m", "conntrack", "--ctstate", "INVALID", "-j", "DROP"];
  if (id === "ssh") return ["-p", "tcp", "--dport", String(sshPort), "-j", "ACCEPT"];
  if (id === "http") return ["-p", "tcp", "--dport", "80", "-j", "ACCEPT"];
  return ["-p", "tcp", "--dport", "443", "-j", "ACCEPT"];
}

export async function applyBasics(host: HostRow, ids: BasicId[], sshPort: number) {
  if (ids.length === 0) fail("Selecione ao menos uma regra básica", 400);
  assertPort(sshPort);
  const insertOrder: BasicId[] = ["https", "http", "ssh", "established", "invalid", "lo"];
  const selected = insertOrder.filter((id) => ids.includes(id));
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const id of selected) {
    const args = basicArgs(id, sshPort);
    const check = ["iptables", "-C", "INPUT", ...args];
    const insert = ["iptables", "-I", "INPUT", "1", ...args];
    const cmd = [
      `${check.map(shQuote).join(" ")} && echo SKIP_${id}`,
      `${insert.map(shQuote).join(" ")} || sudo -n ${insert.map(shQuote).join(" ")}`,
    ].join(" || ");
    const r = await runOnHost(host, cmd);
    const text = `${r.stdout}\n${r.stderr}`;
    if (text.includes(`SKIP_${id}`)) {
      skipped.push(id);
      continue;
    }
    if (r.code !== 0) fail(r.stderr.trim() || r.stdout.trim() || `falha ao aplicar ${id}`, 500);
    applied.push(id);
  }
  return { ok: true, applied, skipped };
}

export async function addFirewallRule(
  host: HostRow,
  input: {
    chain: FirewallChainName;
    proto: FirewallProto;
    target: FirewallTarget;
    port?: number;
    source?: string;
    motivo?: string;
  },
) {
  assertChain(input.chain);
  assertProto(input.proto);
  assertTarget(input.target);
  assertPort(input.port);
  assertSource(input.source);
  if (input.target === "ACCEPT") {
    const motivo = input.motivo?.trim() ?? "";
    if (motivo.length < 8) fail("Informe o motivo (mínimo 8 caracteres) para abrir uma regra ACCEPT", 400);
  }

  const parts = ["iptables", "-A", input.chain];
  if (input.source) parts.push("-s", input.source);
  parts.push("-p", input.proto);
  if (input.port !== undefined) {
    if (input.proto !== "tcp" && input.proto !== "udp") fail("Porta só com tcp ou udp", 400);
    parts.push("--dport", String(input.port));
  }
  parts.push("-j", input.target);

  const cmd = `${parts.map(shQuote).join(" ")} || sudo -n ${parts.map(shQuote).join(" ")}`;
  const r = await runOnHost(host, cmd);
  if (r.code !== 0) fail(r.stderr.trim() || r.stdout.trim() || "iptables -A falhou", 500);
  return { ok: true };
}

export async function exportFirewall(host: HostRow) {
  const script = [
    "if ! command -v iptables-save >/dev/null 2>&1 && ! command -v iptables >/dev/null 2>&1; then echo NO_IPTABLES; exit 0; fi",
    "iptables-save 2>/dev/null || sudo -n iptables-save",
  ].join("; ");
  const r = await runOnHost(host, script);
  const out = `${r.stdout}\n${r.stderr}`;
  if (out.includes("NO_IPTABLES")) fail("iptables-save não existe neste host", 400);
  const content = r.stdout.trim();
  if (r.code !== 0 || !content) fail(r.stderr.trim() || "iptables-save falhou", 500);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const slug = host.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "host";
  return { filename: `temis-iptables-${slug}-${stamp}.rules`, content };
}

export async function deleteFirewallRule(host: HostRow, chain: FirewallChainName, num: number) {
  assertChain(chain);
  if (!Number.isInteger(num) || num < 1 || num > 500) fail("Número de regra inválido", 400);
  const cmd = `iptables -D ${chain} ${num} || sudo -n iptables -D ${chain} ${num}`;
  const r = await runOnHost(host, cmd);
  if (r.code !== 0) fail(r.stderr.trim() || r.stdout.trim() || "iptables -D falhou", 500);
  return { ok: true, chain, num };
}
