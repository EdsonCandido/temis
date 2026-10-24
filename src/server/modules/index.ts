import type { FastifyInstance } from "fastify";
import { registerFail2banRoutes } from "./fail2ban/routes.js";
import { registerFileminRoutes } from "./filemin/routes.js";
import { registerFirewallRoutes } from "./firewall/routes.js";
import { registerIpfilterRoutes } from "./ipfilter/routes.js";
import { registerProcRoutes } from "./proc/routes.js";
import { registerStatusRoutes } from "./status/routes.js";
import { registerSystemdRoutes } from "./systemd/routes.js";

export async function registerModules(app: FastifyInstance) {
  await registerStatusRoutes(app);
  await registerSystemdRoutes(app);
  await registerProcRoutes(app);
  await registerFail2banRoutes(app);
  await registerFirewallRoutes(app);
  await registerFileminRoutes(app);
  await registerIpfilterRoutes(app);
}
