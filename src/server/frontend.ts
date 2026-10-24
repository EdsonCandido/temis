import path from "node:path";
import type { FastifyInstance } from "fastify";

function skipFrontend(url: string) {
  return url.startsWith("/api") || url === "/health" || url.startsWith("/health?");
}

export async function registerFrontend(app: FastifyInstance, rootDir: string) {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    const { default: middie } = await import("@fastify/middie");
    const { createServer } = await import("vite");
    const vite = await createServer({
      configFile: path.join(rootDir, "vite.config.ts"),
      server: { middlewareMode: true },
      appType: "spa",
    });

    await app.register(middie);
    app.use((req, res, next) => {
      if (skipFrontend(req.url ?? "")) {
        next();
        return;
      }
      vite.middlewares(req, res, next);
    });
    return;
  }

  const { default: fastifyStatic } = await import("@fastify/static");
  const staticRoot = path.join(rootDir, "dist/web");
  await app.register(fastifyStatic, { root: staticRoot, wildcard: false });
  app.setNotFoundHandler((req, reply) => {
    if (skipFrontend(req.url)) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}
