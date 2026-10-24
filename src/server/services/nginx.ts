import fs from "node:fs";
import path from "node:path";
import type { ProxyOptions, StoredProxyOptions } from "../../shared/index.js";
import { nginxDir } from "../paths.js";
import { assertOk, runOnHost, type HostRow } from "./executor.js";
import {
  letsEncryptPaths,
  readLocalCustomCert,
  remoteCertDir,
  remoteCertPaths,
  shellSingleQuote,
} from "./certs.js";

type ProxyForNginx = StoredProxyOptions | ProxyOptions;

function sslPaths(slug: string, domain: string, proxy: ProxyForNginx) {
  if (proxy.certMode === "custom") return remoteCertPaths(slug);
  return letsEncryptPaths(domain);
}

function serverNames(domain: string, proxy: ProxyForNginx) {
  if (proxy.wwwRedirect === "to-www" || proxy.wwwRedirect === "to-apex") {
    return `${domain} www.${domain}`;
  }
  return domain;
}

function certbotDomains(domain: string, proxy: ProxyForNginx) {
  if (proxy.wwwRedirect === "to-www" || proxy.wwwRedirect === "to-apex") {
    return `-d ${domain} -d www.${domain}`;
  }
  return `-d ${domain}`;
}

export function renderNginx(opts: {
  domain: string;
  publishedPort: number;
  proxy: ProxyForNginx;
  slug: string;
  /** Fase 1: só HTTP (para certbot). Fase 2: HTTPS completo. */
  phase: "http-only" | "https";
}) {
  const { domain, publishedPort, proxy, slug, phase } = opts;
  const upstream = `127.0.0.1:${publishedPort}`;
  const names = serverNames(domain, proxy);
  const certs = sslPaths(slug, domain, proxy);

  const ws = proxy.websocket
    ? `
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";`
    : "";
  const gzip = proxy.gzip
    ? `
    gzip on;
    gzip_types text/plain text/css application/json application/javascript application/xml;`
    : "";
  const hsts =
    phase === "https" && proxy.hsts
      ? `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;`
      : "";

  const wwwServer =
    proxy.wwwRedirect === "to-www"
      ? `
server {
    listen 80;
    server_name ${domain};
    return 301 http://www.${domain}$request_uri;
}`
      : proxy.wwwRedirect === "to-apex"
        ? `
server {
    listen 80;
    server_name www.${domain};
    return 301 http://${domain}$request_uri;
}`
        : "";

  const proxyLocation = `
    location / {
        proxy_pass http://${upstream};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;${ws}
    }`;

  if (phase === "http-only") {
    // Sem redirects www nesta fase: ACME precisa responder no apex e no www.
    return `# gerado pelo Helios Temis — fase HTTP (ACME)
server {
    listen 80;
    server_name ${names};
    client_max_body_size ${proxy.clientMaxBodyMb}m;${gzip}
${proxyLocation}
}`.trim();
  }

  const httpBlock = proxy.forceHttps
    ? `
server {
    listen 80;
    server_name ${names};
    return 301 https://$host$request_uri;
}`
    : `
server {
    listen 80;
    server_name ${names};
    client_max_body_size ${proxy.clientMaxBodyMb}m;${gzip}
${proxyLocation}
}`;

  const httpsBlock = `
server {
    listen 443 ssl;
    server_name ${names};
    client_max_body_size ${proxy.clientMaxBodyMb}m;
    ssl_certificate ${certs.fullchain};
    ssl_certificate_key ${certs.privkey};
    ${hsts}${gzip}
${proxyLocation}
}`;

  return `# gerado pelo Helios Temis — não editar à mão
${wwwServer}
${httpBlock}
${httpsBlock}
`.trim();
}

async function writeNginxConf(
  host: HostRow,
  slug: string,
  conf: string,
) {
  const localFile = path.join(nginxDir(), `${slug}.conf`);
  fs.writeFileSync(localFile, conf, "utf8");

  const remotePath = `/etc/nginx/sites-available/temis-${slug}.conf`;
  const enabledPath = `/etc/nginx/sites-enabled/temis-${slug}.conf`;
  const escaped = shellSingleQuote(conf);

  const inner = [
    `mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled`,
    `printf '%s\\n' '${escaped}' > ${remotePath}`,
    `ln -sfn ${remotePath} ${enabledPath}`,
    `command -v nginx >/dev/null || (apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx)`,
    `nginx -t && (systemctl reload nginx || nginx -s reload)`,
  ].join(" && ");

  const result = await runOnHost(host, `sudo bash -lc ${JSON.stringify(inner)}`);
  await assertOk(result, "nginx");
  return localFile;
}

async function installCustomCertOnHost(host: HostRow, slug: string) {
  const local = readLocalCustomCert(slug);
  if (!local) throw new Error("Certificado próprio não encontrado no painel; cole PEM e chave de novo");

  const remote = remoteCertPaths(slug);
  const certEsc = shellSingleQuote(local.certPem.trim() + "\n");
  const keyEsc = shellSingleQuote(local.keyPem.trim() + "\n");

  const inner = [
    `mkdir -p ${remote.dir}`,
    `printf '%s\\n' '${certEsc}' > ${remote.fullchain}`,
    `printf '%s\\n' '${keyEsc}' > ${remote.privkey}`,
    `chmod 600 ${remote.fullchain} ${remote.privkey}`,
    `test -s ${remote.fullchain} && test -s ${remote.privkey}`,
  ].join(" && ");

  const result = await runOnHost(host, `sudo bash -lc ${JSON.stringify(inner)}`);
  await assertOk(result, "instalar certificado próprio");
}

async function issueLetsEncrypt(
  host: HostRow,
  domain: string,
  proxy: ProxyForNginx,
  email: string,
) {
  const certs = letsEncryptPaths(domain);
  const domains = certbotDomains(domain, proxy);
  const inner = [
    `command -v certbot >/dev/null || (apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx)`,
    `certbot certonly --nginx ${domains} --non-interactive --agree-tos -m ${email} --keep-until-expiring`,
    `test -f ${certs.fullchain} && test -f ${certs.privkey}`,
  ].join(" && ");

  const result = await runOnHost(host, `sudo bash -lc ${JSON.stringify(inner)}`);
  if (result.code !== 0) {
    const detail = (result.stderr || result.stdout || "").trim().slice(-800);
    throw new Error(
      `Falha Let's Encrypt para ${domain}. Confira DNS (A/AAAA), porta 80 e e-mail ACME.${detail ? ` Detalhe: ${detail}` : ""}`,
    );
  }
}

export async function applyNginx(
  host: HostRow,
  slug: string,
  domain: string,
  publishedPort: number,
  proxy: ProxyForNginx,
  email: string,
) {
  const normalized: ProxyForNginx = {
    ...proxy,
    https: true,
    certMode: proxy.certMode ?? "auto",
  };

  // Fase 1: vhost HTTP (necessário para ACME / antes dos PEMs existirem)
  const httpConf = renderNginx({
    domain,
    publishedPort,
    proxy: normalized,
    slug,
    phase: "http-only",
  });
  await writeNginxConf(host, slug, httpConf);

  if (normalized.certMode === "custom") {
    await installCustomCertOnHost(host, slug);
  } else {
    await issueLetsEncrypt(host, domain, normalized, email);
  }

  // Fase 2: HTTPS com paths corretos
  const httpsConf = renderNginx({
    domain,
    publishedPort,
    proxy: normalized,
    slug,
    phase: "https",
  });
  const localFile = await writeNginxConf(host, slug, httpsConf);

  // Conferência final dos PEMs no host
  const certs = sslPaths(slug, domain, normalized);
  const check = await runOnHost(
    host,
    `sudo bash -lc ${JSON.stringify(`test -f ${certs.fullchain} && test -f ${certs.privkey}`)}`,
  );
  await assertOk(check, "verificar arquivos de certificado");

  return { confPath: localFile };
}

export async function removeNginx(host: HostRow, slug: string) {
  const remoteCerts = remoteCertDir(slug);
  await runOnHost(
    host,
    `sudo bash -lc ${JSON.stringify(
      `rm -f /etc/nginx/sites-enabled/temis-${slug}.conf /etc/nginx/sites-available/temis-${slug}.conf; rm -rf ${remoteCerts}; nginx -t && (systemctl reload nginx || nginx -s reload) || true`,
    )}`,
  );
}
