import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import { Client } from "ssh2";
import type { InferSelectModel } from "drizzle-orm";
import type { hosts } from "../db/schema.js";

const execFileAsync = promisify(execFile);
export type HostRow = InferSelectModel<typeof hosts>;

export type ExecResult = { stdout: string; stderr: string; code: number };

function localShell(command: string): Promise<ExecResult> {
  return new Promise((resolve) => {
    execFile(
      "/bin/bash",
      ["-lc", command],
      { maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          code: error && typeof error.code === "number" ? error.code : error ? 1 : 0,
        });
      },
    );
  });
}

function sshShell(host: HostRow, command: string): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    if (!host.sshHost || !host.sshUser) {
      reject(new Error("Host SSH incompleto"));
      return;
    }
    const conn = new Client();
    const cfg: Record<string, unknown> = {
      host: host.sshHost,
      port: host.sshPort ?? 22,
      username: host.sshUser,
      readyTimeout: 15000,
    };
    if (host.sshKeyPath) {
      cfg.privateKey = fs.readFileSync(host.sshKeyPath);
    }
    if (host.sshPassword) {
      cfg.password = host.sshPassword;
      cfg.tryKeyboard = true;
    }
    conn
      .on("keyboard-interactive", (_n, _i, _l, _prompts, finish: (responses: string[]) => void) => {
        finish(host.sshPassword ? [host.sshPassword] : []);
      })
      .on("ready", () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            reject(err);
            return;
          }
          let stdout = "";
          let stderr = "";
          stream
            .on("close", (code: number) => {
              conn.end();
              resolve({ stdout, stderr, code: code ?? 0 });
            })
            .on("data", (d: Buffer) => {
              stdout += d.toString();
            });
          stream.stderr.on("data", (d: Buffer) => {
            stderr += d.toString();
          });
        });
      })
      .on("error", reject)
      .connect(cfg);
  });
}

export async function runOnHost(host: HostRow, command: string): Promise<ExecResult> {
  if (host.kind === "local") return localShell(command);
  return sshShell(host, command);
}

export async function assertOk(result: ExecResult, label: string) {
  if (result.code !== 0) {
    throw new Error(`${label} falhou (${result.code}): ${result.stderr || result.stdout}`);
  }
  return result;
}

export async function pingDocker(host: HostRow) {
  const r = await runOnHost(host, "docker info --format '{{.ServerVersion}}'");
  if (r.code !== 0) throw new Error(r.stderr || "Docker indisponível neste host");
  return r.stdout.trim();
}

function connectErrorMessage(raw: string) {
  if (/ENOTFOUND|getaddrinfo/i.test(raw)) return "Host não resolve no DNS";
  if (/ECONNREFUSED/i.test(raw)) return "VPS recusou a porta SSH";
  if (/ETIMEDOUT|Timed out|EHOSTUNREACH|ECONNRESET/i.test(raw)) return "VPS não responde";
  if (/authentication methods failed|Permission denied|All configured authentication/i.test(raw)) {
    return "VPS respondeu, mas o login falhou";
  }
  return raw;
}

export async function probeConnection(host: HostRow) {
  const started = Date.now();
  try {
    const r = await runOnHost(host, "printf 'TEMIS_OK\\n'; hostname; whoami");
    const lines = r.stdout
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (r.code !== 0 || !lines.includes("TEMIS_OK")) {
      throw new Error(r.stderr.trim() || r.stdout.trim() || "Prova após o login falhou");
    }
    return {
      ok: true,
      reachable: true,
      loggedIn: true,
      hostname: lines[1] ?? host.name,
      user: lines[2] ?? host.sshUser ?? "",
      ms: Date.now() - started,
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    throw Object.assign(new Error(connectErrorMessage(raw)), { statusCode: 400 });
  }
}

export { execFileAsync };
