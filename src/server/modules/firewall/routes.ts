import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { parseHostId, requireHost } from "../host.js";
import {
  BASIC_IDS,
  CHAINS,
  PROTOS,
  TARGETS,
  addFirewallRule,
  applyBasics,
  deleteFirewallRule,
  exportFirewall,
  listFirewall,
} from "./service.js";

const addBody = z.object({
  hostId: z.number().int().positive(),
  chain: z.enum(CHAINS),
  proto: z.enum(PROTOS),
  target: z.enum(TARGETS),
  port: z.number().int().min(1).max(65535).optional(),
  source: z.string().min(1).max(32).optional(),
  motivo: z.string().max(240).optional(),
});

const basicsBody = z.object({
  hostId: z.number().int().positive(),
  ids: z.array(z.enum(BASIC_IDS)).min(1),
  sshPort: z.number().int().min(1).max(65535).default(22),
});

const deleteBody = z.object({
  hostId: z.number().int().positive(),
  chain: z.enum(CHAINS),
  num: z.number().int().positive(),
});

export async function registerFirewallRoutes(app: FastifyInstance) {
  app.get("/api/modules/firewall", async (req) => {
    const hostId = parseHostId((req.query as { hostId?: string }).hostId);
    return listFirewall(requireHost(hostId));
  });

  app.get("/api/modules/firewall/export", async (req) => {
    const hostId = parseHostId((req.query as { hostId?: string }).hostId);
    return exportFirewall(requireHost(hostId));
  });

  app.post("/api/modules/firewall/add", async (req) => {
    const body = addBody.parse(req.body);
    return addFirewallRule(requireHost(body.hostId), body);
  });

  app.post("/api/modules/firewall/delete", async (req) => {
    const body = deleteBody.parse(req.body);
    return deleteFirewallRule(requireHost(body.hostId), body.chain, body.num);
  });

  app.post("/api/modules/firewall/basics", async (req) => {
    const body = basicsBody.parse(req.body);
    return applyBasics(requireHost(body.hostId), body.ids, body.sshPort);
  });
}
