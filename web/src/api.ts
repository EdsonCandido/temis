const TOKEN_KEY = "temis_token";

export function token() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(value: string | null) {
  if (value) localStorage.setItem(TOKEN_KEY, value);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  const t = token();
  if (t) headers.set("Authorization", `Bearer ${t}`);
  const res = await fetch(path, { ...init, headers });
  if (res.status === 401) {
    setToken(null);
    if (!path.includes("/auth/login")) window.location.href = "/login";
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || res.statusText);
  return data as T;
}

export type Host = {
  id: number;
  name: string;
  kind: "local" | "ssh";
  sshHost: string | null;
  sshPort: number | null;
  sshUser: string | null;
  sshKeyPath: string | null;
};

export type AppRow = {
  id: number;
  hostId: number;
  name: string;
  slug: string;
  domain: string;
  sourceType: "docker" | "github";
  sourceUrl: string;
  githubRef: string | null;
  dockerfilePath: string | null;
  internalPort: number;
  envText: string;
  proxyJson: string;
  status: string;
  lastError: string | null;
  publishedPort: number | null;
};

export type Metrics = {
  hostname: string;
  cpuCount: number;
  load1: number;
  memUsedMb: number;
  memTotalMb: number;
  memPercent: number;
  diskUsedGb: number;
  diskTotalGb: number;
  diskPercent: number;
  dockerOk: boolean;
  containers: Array<{ name: string; status: string; cpu: string; mem: string; memPercent: string }>;
};

export type ProxyOptions = {
  https: boolean;
  forceHttps: boolean;
  websocket: boolean;
  gzip: boolean;
  wwwRedirect: "none" | "to-www" | "to-apex";
  clientMaxBodyMb: number;
  hsts: boolean;
  certMode: "auto" | "custom";
  hasCustomCert: boolean;
  certPem?: string;
  keyPem?: string;
};
