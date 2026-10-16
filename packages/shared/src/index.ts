import { z } from "zod";

export const hostKindSchema = z.enum(["local", "ssh"]);

export const proxyOptionsSchema = z.object({
  https: z.boolean().default(true),
  forceHttps: z.boolean().default(true),
  websocket: z.boolean().default(true),
  gzip: z.boolean().default(true),
  wwwRedirect: z.enum(["none", "to-www", "to-apex"]).default("none"),
  clientMaxBodyMb: z.number().int().min(1).max(2048).default(64),
  hsts: z.boolean().default(true),
});

export type ProxyOptions = z.infer<typeof proxyOptionsSchema>;

export const hostInputSchema = z.object({
  name: z.string().min(1).max(80),
  kind: hostKindSchema,
  sshHost: z.string().optional(),
  sshPort: z.number().int().min(1).max(65535).optional(),
  sshUser: z.string().optional(),
  sshKeyPath: z.string().optional(),
});

export const appInputSchema = z.object({
  hostId: z.number().int(),
  name: z.string().min(1).max(80),
  domain: z.string().min(3).max(253),
  sourceType: z.enum(["docker", "github"]),
  sourceUrl: z.string().min(3),
  githubRef: z.string().optional().default("main"),
  dockerfilePath: z.string().optional().default("Dockerfile"),
  internalPort: z.number().int().min(1).max(65535),
  envText: z.string().optional().default(""),
  proxy: proxyOptionsSchema.optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(4),
});

export const defaultProxyOptions = (): ProxyOptions => ({
  https: true,
  forceHttps: true,
  websocket: true,
  gzip: true,
  wwwRedirect: "none",
  clientMaxBodyMb: 64,
  hsts: true,
});
