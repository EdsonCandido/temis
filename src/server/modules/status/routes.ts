import type { FastifyInstance } from "fastify";
import { parseHostId, requireHost } from "../host.js";
import { collectStatus } from "./service.js";

export async function registerStatusRoutes(app: FastifyInstance) {
  app.get("/api/modules/status", async (req) => {
    const hostId = parseHostId((req.query as { hostId?: string }).hostId);
    const host = requireHost(hostId);
    return collectStatus(host);
  });
}
