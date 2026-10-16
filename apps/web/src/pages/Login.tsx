import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api";

export function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@temis.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const res = await api<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      nav("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "falha no login");
    }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={onSubmit}>
        <p className="kicker">acesso</p>
        <h1>Temis</h1>
        <p>painel da VPS. Docker, GitHub, nginx — sem editar config na mão.</p>
        <label>
          e-mail
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          senha
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="bad">{error}</p>}
        <button type="submit">Entrar</button>
      </form>
    </div>
  );
}
