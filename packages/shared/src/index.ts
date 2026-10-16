import { z } from "zod";

export const hostKindSchema = z.enum(["local", "ssh"]);

export const certModeSchema = z.enum(["auto", "custom"]);

const looksLikePemCert = (value: string) =>
  /-----BEGIN CERTIFICATE-----[\s\S]+-----END CERTIFICATE-----/.test(value.trim());

const looksLikePemKey = (value: string) =>
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]+-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(
    value.trim(),
  );

export const proxyOptionsSchema = z
  .object({
    https: z.boolean().default(true),
    forceHttps: z.boolean().default(true),
    websocket: z.boolean().default(true),
    gzip: z.boolean().default(true),
    wwwRedirect: z.enum(["none", "to-www", "to-apex"]).default("none"),
    clientMaxBodyMb: z.number().int().min(1).max(2048).default(64),
    hsts: z.boolean().default(true),
    certMode: certModeSchema.default("auto"),
    /** Indica se já há PEM próprio persistido (nunca inclui o conteúdo). */
    hasCustomCert: z.boolean().default(false),
    /** Só no input; nunca serializar em proxyJson. */
    certPem: z.string().optional(),
    keyPem: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.certMode !== "custom") return;
    const hasNew = Boolean(val.certPem?.trim() && val.keyPem?.trim());
    if (!hasNew && !val.hasCustomCert) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Certificado próprio exige fullchain PEM e chave privada",
        path: ["certPem"],
      });
      return;
    }
    if (val.certPem !== undefined && val.certPem.trim() && !looksLikePemCert(val.certPem)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "certPem inválido: esperado bloco BEGIN CERTIFICATE",
        path: ["certPem"],
      });
    }
    if (val.keyPem !== undefined && val.keyPem.trim() && !looksLikePemKey(val.keyPem)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "keyPem inválido: esperado bloco BEGIN PRIVATE KEY",
        path: ["keyPem"],
      });
    }
    if ((val.certPem?.trim() && !val.keyPem?.trim()) || (val.keyPem?.trim() && !val.certPem?.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Informe certificado e chave juntos",
        path: ["keyPem"],
      });
    }
  });

export type ProxyOptions = z.infer<typeof proxyOptionsSchema>;

/** Campos seguros para persistir em proxyJson (sem PEMs). */
export type StoredProxyOptions = Omit<ProxyOptions, "certPem" | "keyPem">;

export function stripProxySecrets(proxy: ProxyOptions): StoredProxyOptions {
  const { certPem: _c, keyPem: _k, ...rest } = proxy;
  return {
    ...rest,
    https: true,
    hasCustomCert: rest.certMode === "custom" ? rest.hasCustomCert || Boolean(_c?.trim() && _k?.trim()) : false,
  };
}

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

export const defaultProxyOptions = (): StoredProxyOptions => ({
  https: true,
  forceHttps: true,
  websocket: true,
  gzip: true,
  wwwRedirect: "none",
  clientMaxBodyMb: 64,
  hsts: true,
  certMode: "auto",
  hasCustomCert: false,
});
