import { runOnHost, type HostRow } from "../../services/executor.js";

export const UNIT_RE = /^[A-Za-z0-9:_.@\\-]+\.service$/;
export const SYSTEMD_ACTIONS = ["start", "stop", "restart", "enable", "disable"] as const;
export type SystemdAction = (typeof SYSTEMD_ACTIONS)[number];

export type SystemdUnit = {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
  enabled: string;
};

export function assertUnit(unit: string) {
  if (!UNIT_RE.test(unit)) {
    throw Object.assign(new Error("Nome de unidade inválido"), { statusCode: 400 });
  }
}

export function parseUnitList(stdout: string): { available: boolean; units: SystemdUnit[] } {
  if (stdout.includes("NO_SYSTEMD")) return { available: false, units: [] };

  const files = new Map<string, string>();
  const filesBlock = stdout.split("---FILES---")[1] ?? "";
  for (const line of filesBlock.split("\n")) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2 && parts[0].endsWith(".service")) {
      files.set(parts[0], parts[1]);
    }
  }

  const units: SystemdUnit[] = [];
  const unitsBlock = stdout.split("---UNITS---")[1]?.split("---FILES---")[0] ?? stdout;
  for (const raw of unitsBlock.split("\n")) {
    const line = raw.replace(/^[●○]\s*/, "").trim();
    const m = /^(\S+\.service)\s+(\S+)\s+(\S+)\s+(\S+)\s+(.*)$/.exec(line);
    if (!m) continue;
    units.push({
      unit: m[1],
      load: m[2],
      active: m[3],
      sub: m[4],
      description: m[5].trim(),
      enabled: files.get(m[1]) ?? "unknown",
    });
  }

  return { available: true, units };
}

export async function listUnits(host: HostRow) {
  const script = [
    "if ! command -v systemctl >/dev/null 2>&1; then echo NO_SYSTEMD; exit 0; fi",
    "echo '---UNITS---'",
    "systemctl list-units --type=service --all --no-pager --no-legend --plain",
    "echo '---FILES---'",
    "systemctl list-unit-files --type=service --no-pager --no-legend --plain",
  ].join("; ");
  const r = await runOnHost(host, script);
  const parsed = parseUnitList(`${r.stdout}\n${r.stderr}`);
  if (!parsed.available) {
    return { available: false, units: [] as SystemdUnit[], message: "systemctl não existe neste host" };
  }
  return { available: true, units: parsed.units, message: null as string | null };
}

export async function runUnitAction(host: HostRow, unit: string, action: SystemdAction) {
  assertUnit(unit);
  const cmd = `systemctl ${action} -- ${unit} || sudo -n systemctl ${action} -- ${unit}`;
  const r = await runOnHost(host, cmd);
  if (r.code !== 0) {
    throw Object.assign(new Error(r.stderr.trim() || r.stdout.trim() || `systemctl ${action} falhou`), {
      statusCode: 500,
    });
  }
  return { ok: true, unit, action };
}
