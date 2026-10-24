import type { FastifyInstance } from "fastify";
import { parseHostId, requireHost } from "../host.js";
import { listIpfilter } from "./service.js";

export async function registerIpfilterRoutes(app: FastifyInstance) {
  app.get("/api/modules/ipfilter", async (req) => {
    const hostId = parseHostId((req.query as { hostId?: string }).hostId);
    return listIpfilter(requireHost(hostId));
  });
}
