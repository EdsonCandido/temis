import { runOnHost, type HostRow } from "../../services/executor.js";
import { fail, shQuote } from "../sh.js";

const MAX_READ = 200_000;
const PROTECTED_EXACT = new Set(["/", "/bin", "/boot", "/dev", "/etc", "/lib", "/lib64", "/proc", "/root", "/sbin", "/sys", "/usr", "/var"]);
const PROTECTED_PREFIX = ["/proc/", "/sys/", "/dev/"];

export type FileEntry = {
  name: string;
  kind: "dir" | "file" | "link" | "other";
  size: number;
  mtime: number;
  mode: string;
};

export function assertSafePath(raw: string) {
  if (typeof raw !== "string" || raw.length < 1 || raw.length > 1024) fail("Caminho inválido", 400);
  if (!raw.startsWith("/") || raw.includes("\0")) fail("Caminho inválido", 400);
  const parts = raw.split("/");
  if (parts.some((p) => p === "..")) fail("Caminho inválido", 400);
}

export function assertDeletable(path: string) {
  assertSafePath(path);
  if (PROTECTED_EXACT.has(path) || PROTECTED_PREFIX.some((p) => path.startsWith(p))) {
    fail("Caminho protegido", 400);
  }
}

function pyList(path: string) {
  return [
    `export TEMIS_PATH=${shQuote(path)}`,
    "PY=python3; command -v python3 >/dev/null 2>&1 || PY=python",
    "if ! command -v \"$PY\" >/dev/null 2>&1; then echo NO_PYTHON; exit 0; fi",
    "$PY - <<'PY'",
    "import json, os, stat",
    "root = os.environ['TEMIS_PATH']",
    "if not os.path.isdir(root):",
    "    print('NOT_DIR')",
    "    raise SystemExit(0)",
    "entries = []",
    "try:",
    "    names = os.listdir(root)",
    "except OSError as e:",
    "    print('LIST_ERR ' + str(e))",
    "    raise SystemExit(0)",
    "for name in sorted(names, key=str.lower):",
    "    full = os.path.join(root, name)",
    "    try:",
    "        st = os.lstat(full)",
    "    except OSError:",
    "        continue",
    "    if stat.S_ISDIR(st.st_mode): kind = 'dir'",
    "    elif stat.S_ISLNK(st.st_mode): kind = 'link'",
    "    elif stat.S_ISREG(st.st_mode): kind = 'file'",
    "    else: kind = 'other'",
    "    entries.append({'name': name, 'kind': kind, 'size': st.st_size, 'mtime': int(st.st_mtime), 'mode': oct(st.st_mode)[-3:]})",
    "print(json.dumps({'path': root, 'entries': entries}))",
    "PY",
  ].join("\n");
}

export function parseListOutput(stdout: string): { path: string; entries: FileEntry[] } | { error: string } {
  const text = stdout.trim();
  if (text.includes("NO_PYTHON")) return { error: "python3 ausente neste host" };
  if (text.includes("NOT_DIR")) return { error: "Caminho não é um diretório" };
  if (text.startsWith("LIST_ERR")) return { error: text.replace(/^LIST_ERR\s*/, "") || "Falha ao listar" };
  const line = text
    .split("\n")
    .reverse()
    .find((l) => l.startsWith("{"));
  if (!line) return { error: "Resposta inválida do host" };
  try {
    const data = JSON.parse(line) as { path: string; entries: FileEntry[] };
    if (!data.path || !Array.isArray(data.entries)) return { error: "Resposta inválida do host" };
    return data;
  } catch {
    return { error: "Resposta inválida do host" };
  }
}

export async function listDir(host: HostRow, path: string) {
  assertSafePath(path);
  const r = await runOnHost(host, pyList(path));
  const parsed = parseListOutput(`${r.stdout}\n${r.stderr}`);
  if ("error" in parsed) fail(parsed.error, r.code !== 0 ? 500 : 400);
  return parsed;
}

export async function readFile(host: HostRow, path: string) {
  assertSafePath(path);
  const script = [
    `export TEMIS_PATH=${shQuote(path)}`,
    `export TEMIS_MAX=${MAX_READ}`,
    "PY=python3; command -v python3 >/dev/null 2>&1 || PY=python",
    "if ! command -v \"$PY\" >/dev/null 2>&1; then echo NO_PYTHON; exit 0; fi",
    "$PY - <<'PY'",
    "import json, os, stat",
    "p = os.environ['TEMIS_PATH']",
    "mx = int(os.environ['TEMIS_MAX'])",
    "try:",
    "    st = os.stat(p)",
    "except OSError as e:",
    "    print('READ_ERR ' + str(e)); raise SystemExit(0)",
    "if not stat.S_ISREG(st.st_mode):",
    "    print('NOT_FILE'); raise SystemExit(0)",
    "truncated = st.st_size > mx",
    "with open(p, 'rb') as f:",
    "    data = f.read(mx)",
    "text = data.decode('utf-8', errors='replace')",
    "print(json.dumps({'path': p, 'size': st.st_size, 'truncated': truncated, 'content': text}))",
    "PY",
  ].join("\n");
  const r = await runOnHost(host, script);
  const out = `${r.stdout}\n${r.stderr}`.trim();
  if (out.includes("NO_PYTHON")) fail("python3 ausente neste host", 400);
  if (out.includes("NOT_FILE")) fail("Caminho não é um arquivo", 400);
  if (out.includes("READ_ERR")) fail(out.replace(/^[\s\S]*READ_ERR\s*/, "").split("\n")[0] || "Falha ao ler", 500);
  const line = out
    .split("\n")
    .reverse()
    .find((l) => l.startsWith("{"));
  if (!line) fail(r.stderr.trim() || "Falha ao ler arquivo", 500);
  return JSON.parse(line) as { path: string; size: number; truncated: boolean; content: string };
}

export async function makeDir(host: HostRow, path: string) {
  assertSafePath(path);
  assertDeletable(path);
  const cmd = `mkdir ${shQuote(path)} || sudo -n mkdir ${shQuote(path)}`;
  const r = await runOnHost(host, cmd);
  if (r.code !== 0) fail(r.stderr.trim() || r.stdout.trim() || "mkdir falhou", 500);
  return { ok: true, path };
}

export async function removePath(host: HostRow, path: string) {
  assertDeletable(path);
  const cmd = `p=${shQuote(path)}; if [ -d "$p" ] && [ ! -L "$p" ]; then rmdir "$p" || sudo -n rmdir "$p"; else rm -f "$p" || sudo -n rm -f "$p"; fi`;
  const r = await runOnHost(host, cmd);
  if (r.code !== 0) fail(r.stderr.trim() || r.stdout.trim() || "remoção falhou", 500);
  return { ok: true, path };
}
