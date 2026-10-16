import { FormEvent, useEffect, useState } from "react";
import { api, type Host } from "../api";

export function Hosts() {
  const [list, setList] = useState<Host[]>([]);
  const [kind, setKind] = useState<"local" | "ssh">("local");
  const [msg, setMsg] = useState("");

  async function load() {
    setList(await api<Host[]>("/api/hosts"));
  }

  useEffect(() => {
    load().catch((e) => setMsg(e.message));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      name: String(fd.get("name")),
      kind,
      sshHost: String(fd.get("sshHost") || "") || undefined,
      sshPort: Number(fd.get("sshPort") || 22),
      sshUser: String(fd.get("sshUser") || "") || undefined,
      sshKeyPath: String(fd.get("sshKeyPath") || "") || undefined,
    };
    await api("/api/hosts", { method: "POST", body: JSON.stringify(body) });
    e.currentTarget.reset();
    await load();
  }

  return (
    <>
      <p className="kicker">máquinas</p>
      <h1>Hosts</h1>
      <p>Local = Temis na mesma máquina (notebook ou VPS). SSH = Temis controla a VPS à distância.</p>
      {msg && <p className="bad">{msg}</p>}
      <form onSubmit={onSubmit} className="card">
        <label>
          nome
          <input name="name" required placeholder="vps-prod" />
        </label>
        <label>
          tipo
          <select value={kind} onChange={(e) => setKind(e.target.value as "local" | "ssh")}>
            <option value="local">local (Docker nesta máquina)</option>
            <option value="ssh">SSH (VPS remota)</option>
          </select>
        </label>
        {kind === "ssh" && (
          <>
            <label>
              host SSH
              <input name="sshHost" placeholder="203.0.113.10" required />
            </label>
            <label>
              porta
              <input name="sshPort" type="number" defaultValue={22} />
            </label>
            <label>
              usuário
              <input name="sshUser" placeholder="root" required />
            </label>
            <label>
              caminho da chave privada
              <input name="sshKeyPath" placeholder="/Users/voce/.ssh/id_ed25519" />
            </label>
          </>
        )}
        <button type="submit">Cadastrar host</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>nome</th>
            <th>tipo</th>
            <th>alvo</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map((h) => (
            <tr key={h.id}>
              <td>{h.name}</td>
              <td>{h.kind}</td>
              <td className="mono">{h.kind === "ssh" ? `${h.sshUser}@${h.sshHost}:${h.sshPort}` : "localhost"}</td>
              <td className="row">
                <button
                  className="ghost"
                  onClick={async () => {
                    try {
                      const r = await api<{ docker: string }>(`/api/hosts/${h.id}/test`, { method: "POST" });
                      setMsg(`Docker ${r.docker} em ${h.name}`);
                    } catch (e) {
                      setMsg(e instanceof Error ? e.message : "falha");
                    }
                  }}
                >
                  testar Docker
                </button>
                <button
                  className="danger"
                  onClick={async () => {
                    await api(`/api/hosts/${h.id}`, { method: "DELETE" });
                    await load();
                  }}
                >
                  remover
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
