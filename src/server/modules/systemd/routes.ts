import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseHostId, requireHost } from "../host.js";
import { SYSTEMD_ACTIONS, assertUnit, listUnits, runUnitAction } from "./service.js";

const actionBody = z.object({
  hostId: z.number().int().positive(),
  unit: z.string().min(1),
  action: z.enum(SYSTEMD_ACTIONS),
});

export async function registerSystemdRoutes(app: FastifyInstance) {
  app.get("/api/modules/systemd", async (req) => {
    const hostId = parseHostId((req.query as { hostId?: string }).hostId);
    return listUnits(requireHost(hostId));
  });

  app.post("/api/modules/systemd/action", async (req) => {
    const body = actionBody.parse(req.body);
    assertUnit(body.unit);
    return runUnitAction(requireHost(body.hostId), body.unit, body.action);
  });
}
