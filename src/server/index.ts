import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import Fastify from "fastify";

const rootDir = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
dotenv.config({ path: path.join(rootDir, ".env") });
dotenv.config();

import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import { seedAdmin } from "./db/index.js";
import { registerAuth } from "./auth.js";
import { registerRoutes } from "./routes.js";
import { registerModules } from "./modules/index.js";
import { registerFrontend } from "./frontend.js";

const app = Fastify({ logger: true });

app.setErrorHandler((err, _req, reply) => {
  const status = (err as { statusCode?: number }).statusCode ?? 500;
  const issue = err.name === "ZodError" ? 400 : status;
  reply.code(issue).send({ error: err.message });
});

await app.register(cors, { origin: true });
await app.register(jwt, { secret: process.env.JWT_SECRET ?? "temis-dev-secret" });

await seedAdmin();
await registerAuth(app);
await registerRoutes(app);
await registerModules(app);

app.get("/health", async () => ({ ok: true, name: "helios-temis" }));

await registerFrontend(app, rootDir);

const port = Number(process.env.PORT ?? 3780);
await app.listen({ port, host: "0.0.0.0" });
