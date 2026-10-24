import { runOnHost, type HostRow } from "../../services/executor.js";
import { fail, shQuote } from "../sh.js";

export const JAIL_RE = /^[A-Za-z0-9._-]{1,64}$/;
export const IPV4_RE = /^(?:(?:25[0-5]|2[0-4]\d|1?\d{1,2})\.){3}(?:25[0-5]|2[0-4]\d|1?\d{1,2})$/;

export type Fail2banJail = {
  name: string;
  currentlyFailed: number;
  totalFailed: number;
  currentlyBanned: number;
  totalBanned: number;
  banned: string[];
};

export function assertJail(name: string) {
  if (!JAIL_RE.test(name)) fail("Nome de jail inválido", 400);
}

export function assertIpv4(ip: string) {
  if (!IPV4_RE.test(ip)) fail("IPv4 inválido", 400);
}

export function parseJailNames(statusOut: string): string[] {
  const m = /Jail list:\s*(.*)$/im.exec(statusOut);
  if (!m) return [];
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => JAIL_RE.test(s));
}

function numField(block: string, label: string) {
  const m = new RegExp(`${label}:\\s*(\\d+)`, "i").exec(block);
  return m ? Number(m[1]) : 0;
}

export function parseJailStatus(name: string, block: string): Fail2banJail {
  const bannedLine = /Banned IP list:\s*(.*)$/im.exec(block);
  const banned = (bannedLine?.[1] ?? "")
    .split(/\s+/)
    .map((s) => s.trim())
    .filter((s) => IPV4_RE.test(s));
  return {
    name,
    currentlyFailed: numField(block, "Currently failed"),
    totalFailed: numField(block, "Total failed"),
    currentlyBanned: numField(block, "Currently banned"),
    totalBanned: numField(block, "Total banned"),
    banned,
  };
}

export type Fail2banReason = "missing" | "stopped" | null;

export function parseSshClientIp(stdout: string): string | null {
  const m = /(?:SSH_CLIENT|SSH_CONNECTION)=((?:\d{1,3}\.){3}\d{1,3})/.exec(stdout);
  if (!m) return null;
  return IPV4_RE.test(m[1]) ? m[1] : null;
}

export function buildIgnoreIps(extra: string[]): string[] {
  const out = ["127.0.0.1/8", "::1"];
  for (const ip of extra) {
    if (IPV4_RE.test(ip) && !out.includes(ip)) out.push(ip);
  }
  return out;
}

export function parseFail2banDump(stdout: string): {
  available: boolean;
  reason: Fail2banReason;
  jails: Fail2banJail[];
} {
  if (stdout.includes("TEMIS_F2B_STOPPED")) return { available: false, reason: "stopped", jails: [] };
  if (stdout.includes("TEMIS_F2B_MISSING") || stdout.includes("NO_FAIL2BAN")) {
    return { available: false, reason: "missing", jails: [] };
  }
  const jails: Fail2banJail[] = [];
  const parts = stdout.split("===JAIL ");
  for (const part of parts.slice(1)) {
    const nl = part.indexOf("\n");
    const name = (nl === -1 ? part : part.slice(0, nl)).replace(/=+$/, "").trim();
    if (!JAIL_RE.test(name)) continue;
    jails.push(parseJailStatus(name, part));
  }
  return { available: true, reason: null, jails };
}

export async function listFail2ban(host: HostRow) {
  const script = [
    "if ! command -v fail2ban-client >/dev/null 2>&1; then echo TEMIS_F2B_MISSING; exit 0; fi",
    "F2B=fail2ban-client",
    "fail2ban-client ping >/dev/null 2>&1 || F2B='sudo -n fail2ban-client'",
    "status=$($F2B status 2>&1) || true",
    "if echo \"$status\" | grep -Eq 'ERROR|Connection refused|Failed to connect'; then echo TEMIS_F2B_STOPPED; echo \"$status\"; exit 0; fi",
    "echo '---STATUS---'",
    "echo \"$status\"",
    "list=$(echo \"$status\" | sed -n 's/.*Jail list:[[:space:]]*//p' | tail -n 1)",
    "IFS=','",
    "for j in $list; do",
    "  j=$(echo \"$j\" | tr -d '[:space:]')",
    "  [ -z \"$j\" ] && continue",
    "  echo \"===JAIL $j===\"",
    "  $F2B status \"$j\" || true",
    "done",
  ].join("\n");
  const r = await runOnHost(host, script);
  const parsed = parseFail2banDump(`${r.stdout}\n${r.stderr}`);
  if (!parsed.available) {
    const missing = parsed.reason === "missing";
    return {
      available: false,
      installed: !missing,
      reason: parsed.reason,
      jails: [] as Fail2banJail[],
      message: missing
        ? "Fail2Ban não está instalado neste host. Sem ele, tentativas repetidas de login SSH não são bloqueadas."
        : "Fail2Ban está instalado, mas o serviço não está em execução.",
    };
  }
  return {
    available: true,
    installed: true,
    reason: null as Fail2banReason,
    jails: parsed.jails,
    message: null as string | null,
  };
}

function jailLocalContent(ignoreIps: string[]) {
  return [
    "# Gerado pelo Temis. Jail sshd conservadora; ignoreip protege o painel.",
    "[DEFAULT]",
    `ignoreip = ${ignoreIps.join(" ")}`,
    "bantime = 1h",
    "findtime = 10m",
    "maxretry = 8",
    "",
    "[sshd]",
    "enabled = true",
    "",
  ].join("\n");
}

export async function setupFail2ban(host: HostRow) {
  const probe = await runOnHost(
    host,
    ['printf "SSH_CLIENT=%s\\n" "${SSH_CLIENT:-}"', 'printf "SSH_CONNECTION=%s\\n" "${SSH_CONNECTION:-}"'].join(
      "\n",
    ),
  );
  const ignoreIps = buildIgnoreIps([parseSshClientIp(probe.stdout) ?? ""]);
  const content = jailLocalContent(ignoreIps);
  const script = [
    "set -e",
    "if ! command -v fail2ban-client >/dev/null 2>&1; then",
    "  if command -v apt-get >/dev/null 2>&1; then",
    "    sudo -n apt-get update -qq",
    "    DEBIAN_FRONTEND=noninteractive sudo -n apt-get install -y fail2ban",
    "  elif command -v dnf >/dev/null 2>&1; then",
    "    sudo -n dnf install -y fail2ban",
    "  elif command -v yum >/dev/null 2>&1; then",
    "    sudo -n yum install -y fail2ban",
    "  else",
    "    echo TEMIS_F2B_NO_PKG",
    "    exit 1",
    "  fi",
    "fi",
    `printf '%s\\n' ${shQuote(content)} | sudo -n tee /etc/fail2ban/jail.d/temis.local >/dev/null`,
    "sudo -n systemctl enable --now fail2ban 2>/dev/null || sudo -n service fail2ban start",
    "sudo -n fail2ban-client reload 2>/dev/null || fail2ban-client reload 2>/dev/null || true",
    "command -v fail2ban-client >/dev/null",
  ].join("\n");
  const r = await runOnHost(host, script);
  const text = `${r.stdout}\n${r.stderr}`;
  if (text.includes("TEMIS_F2B_NO_PKG")) fail("Nenhum gerenciador de pacotes conhecido (apt, dnf ou yum)", 400);
  if (r.code !== 0) fail(r.stderr.trim() || r.stdout.trim() || "instalação do Fail2Ban falhou", 500);
  return { ok: true, ignoreIps };
}

export async function unbanIp(host: HostRow, jail: string, ip: string) {
  assertJail(jail);
  assertIpv4(ip);
  const cmd = `fail2ban-client set ${shQuote(jail)} unbanip ${shQuote(ip)} || sudo -n fail2ban-client set ${shQuote(jail)} unbanip ${shQuote(ip)}`;
  const r = await runOnHost(host, cmd);
  if (r.code !== 0) {
    fail(r.stderr.trim() || r.stdout.trim() || "unban falhou", 500);
  }
  return { ok: true, jail, ip };
}
