import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { certsDir } from "../paths.js";

export function localCertPaths(slug: string) {
  const dir = certsDir(slug);
  return {
    dir,
    fullchain: path.join(dir, "fullchain.pem"),
    privkey: path.join(dir, "privkey.pem"),
  };
}

export function remoteCertDir(slug: string) {
  return `/etc/temis/certs/${slug}`;
}

export function remoteCertPaths(slug: string) {
  const dir = remoteCertDir(slug);
  return {
    dir,
    fullchain: `${dir}/fullchain.pem`,
    privkey: `${dir}/privkey.pem`,
  };
}

export function letsEncryptPaths(domain: string) {
  return {
    fullchain: `/etc/letsencrypt/live/${domain}/fullchain.pem`,
    privkey: `/etc/letsencrypt/live/${domain}/privkey.pem`,
  };
}

/** Valida PEM localmente com openssl (cert + chave batem). */
export function validateCustomPem(certPem: string, keyPem: string) {
  const cert = certPem.trim();
  const key = keyPem.trim();
  if (!cert.includes("BEGIN CERTIFICATE")) {
    throw new Error("Certificado inválido: esperado bloco BEGIN CERTIFICATE");
  }
  if (!key.includes("PRIVATE KEY")) {
    throw new Error("Chave inválida: esperado bloco BEGIN PRIVATE KEY");
  }

  const tmp = fs.mkdtempSync(path.join(certsDir(), ".validate-"));
  const certFile = path.join(tmp, "cert.pem");
  const keyFile = path.join(tmp, "key.pem");
  try {
    fs.writeFileSync(certFile, cert + "\n", { mode: 0o600 });
    fs.writeFileSync(keyFile, key + "\n", { mode: 0o600 });
    try {
      execFileSync("openssl", ["x509", "-in", certFile, "-noout"], { stdio: "pipe" });
    } catch {
      throw new Error("Certificado PEM inválido (openssl x509 falhou)");
    }
    try {
      execFileSync("openssl", ["pkey", "-in", keyFile, "-check", "-noout"], { stdio: "pipe" });
    } catch {
      // fallback RSA
      try {
        execFileSync("openssl", ["rsa", "-in", keyFile, "-check", "-noout"], { stdio: "pipe" });
      } catch {
        throw new Error("Chave privada PEM inválida (openssl falhou)");
      }
    }
    let certMod: string;
    let keyMod: string;
    try {
      certMod = execFileSync("openssl", ["x509", "-noout", "-modulus", "-in", certFile], {
        encoding: "utf8",
      }).trim();
      keyMod = execFileSync("openssl", ["rsa", "-noout", "-modulus", "-in", keyFile], {
        encoding: "utf8",
      }).trim();
    } catch {
      // EC keys: compare public key DER
      try {
        const certPub = execFileSync(
          "openssl",
          ["x509", "-in", certFile, "-pubkey", "-noout"],
          { encoding: "utf8" },
        );
        const keyPub = execFileSync("openssl", ["pkey", "-in", keyFile, "-pubout"], {
          encoding: "utf8",
        });
        if (certPub.trim() !== keyPub.trim()) {
          throw new Error("Certificado e chave privada não correspondem");
        }
        return;
      } catch (err) {
        if (err instanceof Error && err.message.includes("não correspondem")) throw err;
        throw new Error("Não foi possível verificar se certificado e chave correspondem");
      }
    }
    if (certMod !== keyMod) {
      throw new Error("Certificado e chave privada não correspondem");
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export function saveLocalCustomCert(slug: string, certPem: string, keyPem: string) {
  validateCustomPem(certPem, keyPem);
  const paths = localCertPaths(slug);
  fs.writeFileSync(paths.fullchain, certPem.trim() + "\n", { mode: 0o600 });
  fs.writeFileSync(paths.privkey, keyPem.trim() + "\n", { mode: 0o600 });
  fs.chmodSync(paths.fullchain, 0o600);
  fs.chmodSync(paths.privkey, 0o600);
  return paths;
}

export function readLocalCustomCert(slug: string): { certPem: string; keyPem: string } | null {
  const paths = localCertPaths(slug);
  if (!fs.existsSync(paths.fullchain) || !fs.existsSync(paths.privkey)) return null;
  return {
    certPem: fs.readFileSync(paths.fullchain, "utf8"),
    keyPem: fs.readFileSync(paths.privkey, "utf8"),
  };
}

export function removeLocalCustomCert(slug: string) {
  const dir = path.join(certsDir(), slug);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

/** Escapa conteúdo para embutir em printf '%s\n' '...'. */
export function shellSingleQuote(value: string) {
  return value.replace(/'/g, `'\\''`);
}
