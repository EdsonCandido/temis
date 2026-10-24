import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseHostId, requireHost } from "../host.js";
import { listDir, makeDir, readFile, removePath } from "./service.js";

const hostPath = z.object({
  hostId: z.number().int().positive(),
  path: z.string().min(1).max(1024),
});

export async function registerFileminRoutes(app: FastifyInstance) {
  app.get("/api/modules/filemin", async (req) => {
    const q = req.query as { hostId?: string; path?: string };
    const hostId = parseHostId(q.hostId);
    return listDir(requireHost(hostId), q.path || "/");
  });

  app.get("/api/modules/filemin/read", async (req) => {
    const q = req.query as { hostId?: string; path?: string };
    const hostId = parseHostId(q.hostId);
    if (!q.path) throw Object.assign(new Error("path obrigatório"), { statusCode: 400 });
    return readFile(requireHost(hostId), q.path);
  });

  app.post("/api/modules/filemin/mkdir", async (req) => {
    const body = hostPath.parse(req.body);
    return makeDir(requireHost(body.hostId), body.path);
  });

  app.post("/api/modules/filemin/delete", async (req) => {
    const body = hostPath.parse(req.body);
    return removePath(requireHost(body.hostId), body.path);
  });
}
