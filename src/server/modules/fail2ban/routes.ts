import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseHostId, requireHost } from "../host.js";
import { assertIpv4, assertJail, listFail2ban, setupFail2ban, unbanIp } from "./service.js";

const unbanBody = z.object({
  hostId: z.number().int().positive(),
  jail: z.string().min(1),
  ip: z.string().min(1),
});

export async function registerFail2banRoutes(app: FastifyInstance) {
  app.get("/api/modules/fail2ban", async (req) => {
    const hostId = parseHostId((req.query as { hostId?: string }).hostId);
    return listFail2ban(requireHost(hostId));
  });

  app.post("/api/modules/fail2ban/unban", async (req) => {
    const body = unbanBody.parse(req.body);
    assertJail(body.jail);
    assertIpv4(body.ip);
    return unbanIp(requireHost(body.hostId), body.jail, body.ip);
  });

  app.post("/api/modules/fail2ban/setup", async (req) => {
    const body = z.object({ hostId: z.number().int().positive() }).parse(req.body);
    return setupFail2ban(requireHost(body.hostId));
  });
}
