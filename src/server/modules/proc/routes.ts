import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseHostId, requireHost } from "../host.js";
import { SIGNALS, assertPid, listProcesses, signalProcess } from "./service.js";

const signalBody = z.object({
  hostId: z.number().int().positive(),
  pid: z.number().int(),
  signal: z.enum(SIGNALS),
});

export async function registerProcRoutes(app: FastifyInstance) {
  app.get("/api/modules/proc", async (req) => {
    const hostId = parseHostId((req.query as { hostId?: string }).hostId);
    return listProcesses(requireHost(hostId));
  });

  app.post("/api/modules/proc/signal", async (req) => {
    const body = signalBody.parse(req.body);
    assertPid(body.pid);
    return signalProcess(requireHost(body.hostId), body.pid, body.signal);
  });
}
