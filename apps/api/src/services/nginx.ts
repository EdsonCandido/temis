import fs from "node:fs";
import path from "node:path";
import type { ProxyOptions } from "@temis/shared";
import { nginxDir } from "../paths.js";
import { assertOk, runOnHost, type HostRow } from "./executor.js";

export function renderNginx(opts: {
  domain: string;
  publishedPort: number;
  proxy: ProxyOptions;
}) {
  const { domain, publishedPort, proxy } = opts;
  const upstream = `127.0.0.1:${publishedPort}`;
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
  const hsts = proxy.hsts && proxy.https ? `add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;` : "";
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

  const listenHttps = proxy.https
    ? `
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;`
    : "";

  const httpBlock = proxy.https && proxy.forceHttps
    ? `
server {
    listen 80;
    server_name ${domain}${proxy.wwwRedirect === "to-www" ? ` www.${domain}` : ""};
    return 301 https://$host$request_uri;
}`
    : `
server {
    listen 80;
    server_name ${domain};
    client_max_body_size ${proxy.clientMaxBodyMb}m;${gzip}
    location / {
        proxy_pass http://${upstream};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;${ws}
    }
}`;

  const httpsBlock = proxy.https
    ? `
server {
    listen 443 ssl;
    server_name ${domain};
    client_max_body_size ${proxy.clientMaxBodyMb}m;
    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    ${hsts}${gzip}
    location / {
        proxy_pass http://${upstream};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;${ws}
    }
}`
    : "";

  return `# gerado pelo Helios Temis — não editar à mão
${wwwServer}
${httpBlock}
${httpsBlock}
${listenHttps ? "" : ""}
`.trim();
}

export async function applyNginx(
  host: HostRow,
  slug: string,
  domain: string,
  publishedPort: number,
  proxy: ProxyOptions,
  email: string,
) {
  const conf = renderNginx({ domain, publishedPort, proxy });
  const localFile = path.join(nginxDir(), `${slug}.conf`);
  fs.writeFileSync(localFile, conf, "utf8");

  const remotePath = `/etc/nginx/sites-available/temis-${slug}.conf`;
  const enabledPath = `/etc/nginx/sites-enabled/temis-${slug}.conf`;
  const escaped = conf.replace(/'/g, `'\\''`);

  const inner = [
    `mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled`,
    `printf '%s\\n' '${escaped}' > ${remotePath}`,
    `ln -sfn ${remotePath} ${enabledPath}`,
    proxy.https
      ? `command -v certbot >/dev/null || (apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx certbot python3-certbot-nginx)`
      : `command -v nginx >/dev/null || (apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y nginx)`,
    proxy.https
      ? `certbot --nginx -d ${domain} --non-interactive --agree-tos -m ${email} --redirect || true`
      : "true",
    `nginx -t && (systemctl reload nginx || nginx -s reload)`,
  ].join(" && ");
  const cmds = [`sudo bash -lc ${JSON.stringify(inner)}`];

  const result = await runOnHost(host, cmds.join(" && "));
  await assertOk(result, "nginx");
  return { confPath: localFile, remote: result.stdout };
}

export async function removeNginx(host: HostRow, slug: string) {
  await runOnHost(
    host,
    `rm -f /etc/nginx/sites-enabled/temis-${slug}.conf /etc/nginx/sites-available/temis-${slug}.conf; nginx -t && (systemctl reload nginx || nginx -s reload) || true`,
  );
}
