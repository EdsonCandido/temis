import fs from "node:fs";
import path from "node:path";

export function dataDir() {
  const dir = path.resolve(process.env.DATA_DIR ?? "./data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function nginxDir() {
  const dir = path.join(dataDir(), "nginx");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function appsWorkDir() {
  const dir = path.join(dataDir(), "apps");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function certsDir(slug?: string) {
  const dir = path.join(dataDir(), "certs");
  fs.mkdirSync(dir, { recursive: true });
  if (!slug) return dir;
  const appDir = path.join(dir, slug);
  fs.mkdirSync(appDir, { recursive: true });
  return appDir;
}
