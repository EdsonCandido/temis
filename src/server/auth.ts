import type { FastifyInstance, FastifyRequest } from "fastify";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { loginSchema } from "../shared/index.js";
import { db, users } from "./db/index.js";

export async function requireUser(req: FastifyRequest) {
  try {
    await req.jwtVerify();
  } catch {
    throw Object.assign(new Error("Não autenticado"), { statusCode: 401 });
  }
}

export async function registerAuth(app: FastifyInstance) {
  app.post("/api/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const user = db.select().from(users).where(eq(users.email, body.email)).get();
    if (!user || !bcrypt.compareSync(body.password, user.passwordHash)) {
      return reply.code(401).send({ error: "Credenciais inválidas" });
    }
    const token = await reply.jwtSign({ sub: user.id, email: user.email });
    return { token, email: user.email };
  });

  app.get("/api/auth/me", { preHandler: requireUser }, async (req) => {
    return req.user;
  });
}
