import type { FirewallChain } from "./service.js";

const SERVICE: Record<number, string> = {
  22: "SSH",
  80: "HTTP",
  443: "HTTPS",
  21: "FTP",
  25: "SMTP",
  53: "DNS",
  3306: "MySQL",
  5432: "PostgreSQL",
  6379: "Redis",
  27017: "MongoDB",
  2375: "Docker",
  2376: "Docker TLS",
  8080: "HTTP-alt",
  8443: "HTTPS-alt",
};

const RISK_PORTS = new Set([21, 23, 25, 3306, 5432, 6379, 27017, 2375, 2376, 3389]);
const ANALYZE_CHAINS = new Set(["INPUT", "FORWARD", "ufw-user-input", "ufw-user-forward", "DOCKER-USER"]);

export type Listener = {
  proto: string;
  bind: string;
  port: number;
  publicBind: boolean;
};

export type Traffic = {
  tcpEstab: number;
  timeWait: number;
  listeners: Listener[];
};

export type Finding = {
  id: string;
  level: "ok" | "ask" | "risk";
  chain: string;
  num: number | null;
  port: number | null;
  pkts: string;
  bytes: string;
  question: string;
};

export type BasicsStatus = {
  lo: boolean;
  established: boolean;
  ssh: boolean;
  http: boolean;
  https: boolean;
  invalid: boolean;
  sshPort: number;
};

export type SaveRule = {
  chain: string;
  pkts: number;
  bytes: number;
  target: string;
  spec: string;
};

export function parseIptablesSave(stdout: string): SaveRule[] {
  const rules: SaveRule[] = [];
  for (const raw of stdout.split("\n")) {
    const line = raw.trim();
    const m = /^(?:\[(\d+):(\d+)\]\s+)?-A\s+(\S+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const spec = m[4];
    const tm = /\s-j\s+(\S+)/.exec(spec);
    rules.push({
      pkts: Number(m[1] ?? 0),
      bytes: Number(m[2] ?? 0),
      chain: m[3],
      spec,
      target: tm?.[1] ?? "",
    });
  }
  return rules;
}

export function parseSsListen(stdout: string): Listener[] {
  const rows: Listener[] = [];
  for (const raw of stdout.split("\n")) {
    const line = raw.trim();
    if (!line || /^(Netid|State|Active)/i.test(line)) continue;
    const proto = /^(tcp|udp|tcp6|udp6)\b/i.exec(line)?.[1]?.toLowerCase() ?? "";
    const m =
      /(\d{1,3}(?:\.\d{1,3}){3}|\[?[0-9a-fA-F:]+\]?|\*):(\d+)\s/.exec(line) ||
      /\s(\S+):(\d+)\s+\S+$/.exec(line);
    if (!m) continue;
    const bind = m[1].replace(/^\[|\]$/g, "");
    const port = Number(m[2]);
    if (!port) continue;
    const publicBind = bind === "0.0.0.0" || bind === "*" || bind === "::" || bind === "::0";
    rows.push({ proto: proto.replace(/6$/, "") || "tcp", bind, port, publicBind });
  }
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${r.proto}|${r.bind}|${r.port}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function parseSsStats(stdout: string): { tcpEstab: number; timeWait: number } {
  const estab = /estab\s+(\d+)/i.exec(stdout);
  const tw = /timewait\s+(\d+)/i.exec(stdout);
  return { tcpEstab: estab ? Number(estab[1]) : 0, timeWait: tw ? Number(tw[1]) : 0 };
}

export function dportFromSpec(spec: string): number | null {
  const m = /--dport\s+(\d+)\b/.exec(spec) || /\bdpt:(\d+)\b/.exec(spec);
  return m ? Number(m[1]) : null;
}

function isWorldSource(spec: string) {
  if (/\s-s\s+(\S+)/.test(spec)) {
    const src = /\s-s\s+(\S+)/.exec(spec)?.[1] ?? "";
    return src === "0.0.0.0/0" || src === "0.0.0.0" || src === "::/0";
  }
  return true;
}

function isLoopback(spec: string) {
  return /\s-i\s+lo\b/.test(spec) || /\s-s\s+127\./.test(spec);
}

function isEstablished(spec: string) {
  return /ESTABLISHED/.test(spec) && /RELATED/.test(spec);
}

export function detectBasics(save: SaveRule[], sshPort = 22): BasicsStatus {
  const input = save.filter((r) => r.chain === "INPUT" || r.chain.startsWith("ufw-"));
  const has = (test: (r: SaveRule) => boolean) => input.some(test);
  return {
    lo: has((r) => r.target === "ACCEPT" && isLoopback(r.spec)),
    established: has((r) => r.target === "ACCEPT" && isEstablished(r.spec)),
    ssh: has((r) => r.target === "ACCEPT" && dportFromSpec(r.spec) === sshPort),
    http: has((r) => r.target === "ACCEPT" && dportFromSpec(r.spec) === 80),
    https: has((r) => r.target === "ACCEPT" && dportFromSpec(r.spec) === 443),
    invalid: has((r) => (r.target === "DROP" || r.target === "REJECT") && /INVALID/.test(r.spec)),
    sshPort,
  };
}

export function analyzeOpenRules(
  chains: FirewallChain[],
  save: SaveRule[],
  listeners: Listener[],
): Finding[] {
  const findings: Finding[] = [];
  const input = chains.find((c) => c.name === "INPUT");
  if (input?.policy === "ACCEPT") {
    findings.push({
      id: "policy-input",
      level: "risk",
      chain: "INPUT",
      num: null,
      port: null,
      pkts: "0",
      bytes: "0",
      question: "Policy INPUT é ACCEPT. Tudo que não casar regra entra. Qual o motivo de não usar DROP?",
    });
  }

  const listenByPort = new Map<number, Listener[]>();
  for (const l of listeners) {
    const list = listenByPort.get(l.port) ?? [];
    list.push(l);
    listenByPort.set(l.port, list);
  }

  for (const rule of save) {
    if (!ANALYZE_CHAINS.has(rule.chain)) continue;
    if (rule.target !== "ACCEPT") continue;
    if (isLoopback(rule.spec) || isEstablished(rule.spec)) continue;
    if (!isWorldSource(rule.spec)) continue;

    const port = dportFromSpec(rule.spec);
    const name = port ? SERVICE[port] ?? `porta ${port}` : "qualquer porta";
    const hits = listenByPort.get(port ?? -1) ?? [];
    const publicListen = hits.some((l) => l.publicBind);
    const level: Finding["level"] = port && RISK_PORTS.has(port) ? "risk" : port ? "ask" : "risk";

    let question: string;
    if (!port) {
      question = `Regra ACCEPT em ${rule.chain} sem porta. Qual o motivo de aceitar tráfego tão amplo?`;
    } else if (publicListen) {
      question = `${name} escuta em 0.0.0.0:${port} e o firewall aceita qualquer origem. Qual o motivo de não restringir o IP de origem?`;
    } else if (hits.length) {
      question = `${name} escuta só em endereço local, mas a regra aceita ${port} de qualquer origem. A regra pública ainda é necessária?`;
    } else {
      question = `Firewall aceita ${name} (${port}) e nada escuta nessa porta agora. Serviço caiu ou a regra ficou órfã?`;
    }

    const id = `open-${rule.chain}-${port ?? "any"}-${level}`;
    const prev = findings.find((f) => f.id === id);
    if (prev) {
      prev.pkts = String(Number(prev.pkts) + rule.pkts);
      prev.bytes = String(Number(prev.bytes) + rule.bytes);
      continue;
    }
    findings.push({
      id,
      level,
      chain: rule.chain,
      num: null,
      port,
      pkts: String(rule.pkts),
      bytes: String(rule.bytes),
      question,
    });
  }

  for (const [port, hits] of listenByPort) {
    if (!hits.some((l) => l.publicBind)) continue;
    const allowed = save.some(
      (r) => ANALYZE_CHAINS.has(r.chain) && r.target === "ACCEPT" && dportFromSpec(r.spec) === port,
    );
    if (allowed) continue;
    if (input?.policy === "DROP") continue;
    const name = SERVICE[port] ?? `porta ${port}`;
    findings.push({
      id: `listen-${port}`,
      level: RISK_PORTS.has(port) ? "risk" : "ask",
      chain: "INPUT",
      num: null,
      port,
      pkts: "0",
      bytes: "0",
      question: `${name} escuta em endereço público e não há ACCEPT explícito. Policy ${input?.policy ?? "?"} deixa passar? Qual o motivo de expor ${port}?`,
    });
  }

  return findings;
}

export function formatBytes(raw: string) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (n >= 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}
