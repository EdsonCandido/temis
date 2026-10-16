import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type AppRow, type ProxyOptions } from "../api";

const defaults: ProxyOptions = {
  https: true,
  forceHttps: true,
  websocket: true,
  gzip: true,
  wwwRedirect: "none",
  clientMaxBodyMb: 64,
  hsts: true,
};

export function AppDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [app, setApp] = useState<AppRow | null>(null);
  const [proxy, setProxy] = useState<ProxyOptions>(defaults);
  const [logs, setLogs] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function load() {
    const list = await api<AppRow[]>("/api/apps");
    const found = list.find((a) => String(a.id) === id);
    if (!found) throw new Error("App não encontrado");
    setApp(found);
    setProxy({ ...defaults, ...JSON.parse(found.proxyJson) });
    const l = await api<{ container: string; deployments: Array<{ log: string; status: string }> }>(
      `/api/apps/${id}/logs`,
    );
    const lastDep = l.deployments.at(-1)?.log ?? "";
    setLogs([l.container, lastDep].filter(Boolean).join("\n\n--- deploy ---\n\n"));
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [id]);

  async function act(path: string, method = "POST") {
    setBusy(path);
    setError("");
    try {
      await api(`/api/apps/${id}${path}`, { method });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "erro");
    } finally {
      setBusy("");
    }
  }

  async function saveProxy(e: FormEvent) {
    e.preventDefault();
    setBusy("proxy");
    try {
      await api(`/api/apps/${id}/proxy`, { method: "POST", body: JSON.stringify(proxy) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "erro nginx");
    } finally {
      setBusy("");
    }
  }

  if (!app) return <p>{error || "carregando…"}</p>;

  return (
    <>
      <p className="kicker">{app.slug}</p>
      <h1>{app.name}</h1>
      <p>
        <a href={`https://${app.domain}`} target="_blank" rel="noreferrer">
          {app.domain}
        </a>{" "}
        · {app.sourceType} · porta {app.internalPort}
        {app.publishedPort ? ` → 127.0.0.1:${app.publishedPort}` : ""}
      </p>
      <p className={app.status === "error" ? "bad" : "ok"}>{app.status}</p>
      {app.lastError && <p className="bad">{app.lastError}</p>}
      {error && <p className="bad">{error}</p>}
      <div className="row">
        <button disabled={!!busy} onClick={() => act("/deploy")}>
          {busy.includes("deploy") ? "deploy…" : "Deploy"}
        </button>
        <button className="ghost" disabled={!!busy} onClick={() => act("/restart")}>
          Restart
        </button>
        <button className="ghost" disabled={!!busy} onClick={() => act("/stop")}>
          Stop
        </button>
        <button
          className="danger"
          disabled={!!busy}
          onClick={async () => {
            if (!confirm("Remove container, nginx e cadastro?")) return;
            await act("", "DELETE");
            nav("/apps");
          }}
        >
          Remover
        </button>
      </div>
      <h2>Proxy nginx</h2>
      <p>Marca o que quer. Temis gera o vhost e pede certificado. Sem editar nginx na mão.</p>
      <form onSubmit={saveProxy} className="card">
        <label className="toggle">
          <input type="checkbox" checked={proxy.https} onChange={(e) => setProxy({ ...proxy, https: e.target.checked })} />
          HTTPS (Let's Encrypt)
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={proxy.forceHttps}
            onChange={(e) => setProxy({ ...proxy, forceHttps: e.target.checked })}
          />
          forçar HTTPS
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={proxy.websocket}
            onChange={(e) => setProxy({ ...proxy, websocket: e.target.checked })}
          />
          WebSocket
        </label>
        <label className="toggle">
          <input type="checkbox" checked={proxy.gzip} onChange={(e) => setProxy({ ...proxy, gzip: e.target.checked })} />
          gzip
        </label>
        <label className="toggle">
          <input type="checkbox" checked={proxy.hsts} onChange={(e) => setProxy({ ...proxy, hsts: e.target.checked })} />
          HSTS
        </label>
        <label>
          redirecionar www
          <select
            value={proxy.wwwRedirect}
            onChange={(e) => setProxy({ ...proxy, wwwRedirect: e.target.value as ProxyOptions["wwwRedirect"] })}
          >
            <option value="none">não</option>
            <option value="to-www">apex → www</option>
            <option value="to-apex">www → apex</option>
          </select>
        </label>
        <label>
          body máximo (MB)
          <input
            type="number"
            value={proxy.clientMaxBodyMb}
            onChange={(e) => setProxy({ ...proxy, clientMaxBodyMb: Number(e.target.value) })}
          />
        </label>
        <button type="submit" disabled={!!busy}>
          Aplicar proxy
        </button>
      </form>
      <h2>Logs</h2>
      <pre className="logs">{logs || "(vazio — rode um deploy)"}</pre>
    </>
  );
}
