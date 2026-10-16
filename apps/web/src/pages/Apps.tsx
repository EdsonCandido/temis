import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AppRow, type Host } from "../api";

export function Apps() {
  const [apps, setApps] = useState<AppRow[]>([]);
  const [hosts, setHosts] = useState<Host[]>([]);
  const [sourceType, setSourceType] = useState<"docker" | "github">("docker");
  const [error, setError] = useState("");

  async function load() {
    const [a, h] = await Promise.all([api<AppRow[]>("/api/apps"), api<Host[]>("/api/hosts")]);
    setApps(a);
    setHosts(h);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await api("/api/apps", {
      method: "POST",
      body: JSON.stringify({
        hostId: Number(fd.get("hostId")),
        name: String(fd.get("name")),
        domain: String(fd.get("domain")),
        sourceType,
        sourceUrl: String(fd.get("sourceUrl")),
        githubRef: String(fd.get("githubRef") || "main"),
        dockerfilePath: String(fd.get("dockerfilePath") || "Dockerfile"),
        internalPort: Number(fd.get("internalPort")),
        envText: String(fd.get("envText") || ""),
      }),
    });
    e.currentTarget.reset();
    await load();
  }

  return (
    <>
      <p className="kicker">carga útil</p>
      <h1>Aplicações</h1>
      <p>Imagem Docker (registry) ou repositório GitHub. Domínio vira vhost nginx + certificado.</p>
      {error && <p className="bad">{error}</p>}
      {hosts.length === 0 && <p className="warn">Cadastre um host primeiro.</p>}
      <form onSubmit={onSubmit} className="card">
        <label>
          host
          <select name="hostId" required>
            {hosts.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          nome
          <input name="name" required placeholder="atlas-web" />
        </label>
        <label>
          domínio público
          <input name="domain" required placeholder="app.seudominio.com" />
        </label>
        <label>
          origem
          <select value={sourceType} onChange={(e) => setSourceType(e.target.value as "docker" | "github")}>
            <option value="docker">imagem Docker (ghcr / docker hub / registry)</option>
            <option value="github">repositório GitHub</option>
          </select>
        </label>
        <label>
          URL
          <input
            name="sourceUrl"
            required
            placeholder={sourceType === "docker" ? "nginx:alpine" : "https://github.com/org/repo"}
          />
        </label>
        {sourceType === "github" && (
          <>
            <label>
              branch / tag
              <input name="githubRef" defaultValue="main" />
            </label>
            <label>
              Dockerfile
              <input name="dockerfilePath" defaultValue="Dockerfile" />
            </label>
          </>
        )}
        <label>
          porta interna do container
          <input name="internalPort" type="number" defaultValue={80} required />
        </label>
        <label>
          variáveis de ambiente (KEY=valor, uma por linha)
          <textarea name="envText" rows={4} />
        </label>
        <button type="submit" disabled={hosts.length === 0}>
          Cadastrar app
        </button>
      </form>
      <table>
        <thead>
          <tr>
            <th>app</th>
            <th>domínio</th>
            <th>origem</th>
            <th>status</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id}>
              <td>
                <Link to={`/apps/${a.id}`}>{a.name}</Link>
              </td>
              <td className="mono">{a.domain}</td>
              <td>
                {a.sourceType}: {a.sourceUrl}
              </td>
              <td className={a.status === "running" ? "ok" : a.status === "error" ? "bad" : ""}>{a.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
