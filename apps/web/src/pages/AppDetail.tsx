import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type AppRow, type ProxyOptions } from "@/api";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  const [confirmDelete, setConfirmDelete] = useState(false);

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

  if (!app && !error) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!app) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error || "App não encontrado"}</AlertDescription>
      </Alert>
    );
  }

  const proxyScore = [proxy.https, proxy.forceHttps, proxy.websocket, proxy.gzip, proxy.hsts].filter(Boolean).length;

  return (
    <>
      <PageHeader
        kicker={app.slug}
        title={app.name}
        description={`${app.sourceType} · porta ${app.internalPort}${
          app.publishedPort ? ` → 127.0.0.1:${app.publishedPort}` : ""
        }`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={app.status} />
            <Button asChild variant="outline" size="sm">
              <a href={`https://${app.domain}`} target="_blank" rel="noreferrer">
                {app.domain}
              </a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link to="/apps">Voltar</Link>
            </Button>
          </div>
        }
      />

      {app.lastError ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{app.lastError}</AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="mb-6">
        <CardContent className="flex flex-wrap gap-2 pt-5">
          <Button disabled={!!busy} onClick={() => act("/deploy")}>
            {busy.includes("deploy") ? "deploy…" : "Deploy"}
          </Button>
          <Button variant="outline" disabled={!!busy} onClick={() => act("/restart")}>
            Restart
          </Button>
          <Button variant="outline" disabled={!!busy} onClick={() => act("/stop")}>
            Stop
          </Button>
          <Button variant="destructive" disabled={!!busy} onClick={() => setConfirmDelete(true)}>
            Remover
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="proxy">
        <TabsList>
          <TabsTrigger value="proxy">Proxy nginx</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="proxy">
          <Card>
            <CardHeader>
              <CardTitle>Proxy nginx</CardTitle>
              <CardDescription>
                Marca o que quer. Temis gera o vhost e pede certificado. Sem editar nginx na mão. Ativo:{" "}
                {proxyScore}/5 proteções principais.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveProxy} className="grid gap-5 sm:grid-cols-2">
                {(
                  [
                    ["https", "HTTPS (Let's Encrypt)"],
                    ["forceHttps", "forçar HTTPS"],
                    ["websocket", "WebSocket"],
                    ["gzip", "gzip"],
                    ["hsts", "HSTS"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-3">
                    <Label htmlFor={key}>{label}</Label>
                    <Switch
                      id={key}
                      checked={proxy[key]}
                      onCheckedChange={(checked) => setProxy({ ...proxy, [key]: checked })}
                    />
                  </div>
                ))}
                <Field label="redirecionar www" htmlFor="wwwRedirect">
                  <SelectNative
                    id="wwwRedirect"
                    value={proxy.wwwRedirect}
                    onChange={(e) =>
                      setProxy({ ...proxy, wwwRedirect: e.target.value as ProxyOptions["wwwRedirect"] })
                    }
                  >
                    <option value="none">não</option>
                    <option value="to-www">apex → www</option>
                    <option value="to-apex">www → apex</option>
                  </SelectNative>
                </Field>
                <Field label="body máximo (MB)" htmlFor="clientMaxBodyMb">
                  <Input
                    id="clientMaxBodyMb"
                    type="number"
                    value={proxy.clientMaxBodyMb}
                    onChange={(e) => setProxy({ ...proxy, clientMaxBodyMb: Number(e.target.value) })}
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={!!busy}>
                    {busy === "proxy" ? "Aplicando…" : "Aplicar proxy"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Logs</CardTitle>
              <CardDescription>Container + último deploy</CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="max-h-[420px] overflow-auto rounded-md border border-border bg-muted p-4 font-mono text-xs whitespace-pre-wrap text-foreground">
                {logs || "(vazio — rode um deploy)"}
              </pre>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover aplicação?</DialogTitle>
            <DialogDescription>Remove container, nginx e cadastro de {app.name}.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={!!busy}
              onClick={async () => {
                await act("", "DELETE");
                nav("/apps");
              }}
            >
              Remover
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
