import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { apps, deployments, hosts, users } from "./schema.js";
import { dataDir } from "../paths.js";

const dbFile = path.join(dataDir(), "temis.sqlite");
fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const sqlite = new Database(dbFile);
sqlite.pragma("journal_mode = WAL");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hosts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  ssh_host TEXT,
  ssh_port INTEGER,
  ssh_user TEXT,
  ssh_key_path TEXT,
  ssh_password TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS apps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  host_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  domain TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_url TEXT NOT NULL,
  github_ref TEXT,
  dockerfile_path TEXT,
  internal_port INTEGER NOT NULL,
  env_text TEXT NOT NULL DEFAULT '',
  proxy_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'idle',
  last_error TEXT,
  container_name TEXT,
  published_port INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS deployments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  app_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  log TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
`);

const hostCols = sqlite.prepare("PRAGMA table_info(hosts)").all() as Array<{ name: string }>;
if (!hostCols.some((c) => c.name === "ssh_password")) {
  sqlite.exec("ALTER TABLE hosts ADD COLUMN ssh_password TEXT");
}

export const db = drizzle(sqlite, { schema: { users, hosts, apps, deployments } });

export async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL ?? "admin@temis.local";
  const password = process.env.ADMIN_PASSWORD ?? "temis-admin";
  const existing = db.select().from(users).where(eq(users.email, email)).get();
  if (existing) return;
  db.insert(users)
    .values({
      email,
      passwordHash: bcrypt.hashSync(password, 10),
    })
    .run();
}

export { users, hosts, apps, deployments };
