import { eq } from "drizzle-orm";
import { db, hosts } from "../db/index.js";
import type { HostRow } from "../services/executor.js";

export function requireHost(id: number): HostRow {
  const host = db.select().from(hosts).where(eq(hosts.id, id)).get();
  if (!host) throw Object.assign(new Error("Host não encontrado"), { statusCode: 404 });
  return host;
}

export function parseHostId(raw: unknown): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1) {
    throw Object.assign(new Error("hostId inválido"), { statusCode: 400 });
  }
  return id;
}
