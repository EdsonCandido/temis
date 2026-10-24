import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { api, setToken } from "@/api";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/field";
import { ThemeToggle } from "@/components/theme-toggle";
import { Input } from "@/components/ui/input";

export function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("admin@temis.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await api<{ token: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.token);
      nav("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-xl border border-border bg-card px-7 py-8">
        <div className="mb-6 flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-control bg-primary text-sm font-semibold text-white"
          >
            T
          </span>
          <div>
            <p className="text-sm font-medium">Temis</p>
            <p className="text-xs text-muted-foreground">Helios · frota VPS</p>
          </div>
        </div>
        <h1 className="text-[22px] font-semibold">Entrar</h1>
        <p className="mt-1.5 max-w-[42ch] text-sm leading-[1.45] text-muted-foreground">
          Painel da VPS: Docker, GitHub e nginx, sem editar config na mão.
        </p>
        <form onSubmit={onSubmit} className="mt-6 grid gap-4">
          <Field label="E-mail" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Senha" htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-11"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((open) => !open)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                aria-pressed={showPassword}
                title={showPassword ? "Ocultar senha" : "Mostrar senha"}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </Field>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Entrando…" : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
