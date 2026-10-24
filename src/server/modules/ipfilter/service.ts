import { runOnHost, type HostRow } from "../../services/executor.js";

export type IpfilterRule = {
  side: "in" | "out" | "other";
  line: string;
};

export function parseIpfilter(stdout: string): { available: boolean; version: string; rules: IpfilterRule[] } {
  if (stdout.includes("NO_IPFILTER")) return { available: false, version: "", rules: [] };

  const versionBlock = stdout.split("---VERSION---")[1]?.split("---RULES---")[0] ?? "";
  const rulesBlock = stdout.split("---RULES---")[1] ?? stdout;
  const version = versionBlock
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean) ?? "";

  const rules: IpfilterRule[] = [];
  let side: IpfilterRule["side"] = "other";
  for (const raw of rulesBlock.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (/empty list for ipfilter \(in\)/i.test(line) || (/\(in\)/i.test(line) && /list/i.test(line))) {
      side = "in";
      continue;
    }
    if (/empty list for ipfilter \(out\)/i.test(line) || (/\(out\)/i.test(line) && /list/i.test(line))) {
      side = "out";
      continue;
    }
    if (line.startsWith("---")) continue;
    const inferred = /\b(?:pass|block)\s+out\b/i.test(line) || /\bout proto\b/i.test(line)
      ? "out"
      : /\b(?:pass|block)\s+in\b/i.test(line) || /\bin proto\b/i.test(line)
        ? "in"
        : side;
    rules.push({ side: inferred, line });
  }

  return { available: true, version, rules };
}

export async function listIpfilter(host: HostRow) {
  const script = [
    "if ! command -v ipfstat >/dev/null 2>&1 && ! command -v ipf >/dev/null 2>&1; then echo NO_IPFILTER; exit 0; fi",
    "echo '---VERSION---'",
    "ipf -V 2>/dev/null || true",
    "echo '---RULES---'",
    "ipfstat -io 2>/dev/null || sudo -n ipfstat -io 2>/dev/null || true",
  ].join("\n");
  const r = await runOnHost(host, script);
  const parsed = parseIpfilter(`${r.stdout}\n${r.stderr}`);
  if (!parsed.available) {
    return {
      available: false,
      version: "",
      rules: [] as IpfilterRule[],
      message: "ipf/ipfstat não existe neste host (comum em Linux; típico de BSD/Solaris)",
    };
  }
  return { available: true, version: parsed.version, rules: parsed.rules, message: null as string | null };
}
