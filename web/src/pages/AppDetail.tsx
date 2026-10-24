import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, type AppRow, type ProxyOptions } from "@/api";
import { toast } from "@/lib/toast";
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
import { Textarea } from "@/components/ui/textarea";

const defaults: ProxyOptions = {
  https: true,
  forceHttps: true,
  websocket: true,
  gzip: true,
  wwwRedirect: "none",
  clientMaxBodyMb: 64,
  hsts: true,
  certMode: "auto",
  hasCustomCert: false,
};

export function AppDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [app, setApp] = useState<AppRow | null>(null);
  const [proxy, setProxy] = useState<ProxyOptions>(defaults);
  const [certPem, setCertPem] = useState("");
  const [keyPem, setKeyPem] = useState("");
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
    setCertPem("");
    setKeyPem("");
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
      const done =
        method === "DELETE"
          ? "Aplicação removida."
          : path === "/deploy"
            ? "Deploy iniciado."
            : path === "/restart"
              ? "Reinício enviado."
              : path === "/stop"
                ? "Stop enviado."
                : "Ação concluída.";
      toast.success(done);
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
    setError("");
    try {
      const body: ProxyOptions = {
        ...proxy,
        https: true,
        certPem: certPem.trim() || undefined,
        keyPem: keyPem.trim() || undefined,
      };
      if (body.certMode === "custom" && !body.hasCustomCert && (!certPem.trim() || !keyPem.trim())) {
        throw new Error("Certificado próprio exige fullchain PEM e chave privada");
      }
      await api(`/api/apps/${id}/proxy`, { method: "POST", body: JSON.stringify(body) });
      toast.success("Proxy nginx salvo.");
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

  const proxyScore = [proxy.forceHttps, proxy.websocket, proxy.gzip, proxy.hsts].filter(Boolean).length;
  const certLabel = proxy.certMode === "custom" ? "próprio" : "Let's Encrypt";

  return (
    <>
      <PageHeader
        title={app.name}
        description={`${app.slug} · ${app.sourceType} · porta ${app.internalPort}${
          app.publishedPort ? ` → 127.0.0.1:${app.publishedPort}` : ""
        } · TLS ${certLabel}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={app.status} />
            <span className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground">
              {certLabel}
            </span>
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
                TLS obrigatório. Escolha Let's Encrypt (renovação automática) ou cole certificado próprio. Ativo:{" "}
                {proxyScore}/4 opções extras.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={saveProxy} className="grid gap-5 sm:grid-cols-2">
                <Field label="Certificado TLS" htmlFor="certMode" className="sm:col-span-2">
                  <SelectNative
                    id="certMode"
                    value={proxy.certMode}
                    onChange={(e) =>
                      setProxy({
                        ...proxy,
                        certMode: e.target.value as ProxyOptions["certMode"],
                      })
                    }
                  >
                    <option value="auto">Let's Encrypt (automático + renovação)</option>
                    <option value="custom">Certificado próprio (PEM + chave)</option>
                  </SelectNative>
                </Field>
                {proxy.certMode === "custom" ? (
                  <>
                    {proxy.hasCustomCert ? (
                      <p className="sm:col-span-2 text-sm text-muted-foreground">
                        Certificado próprio já salvo. Cole de novo só para substituir.
                      </p>
                    ) : null}
                    <Field label="Certificado (fullchain PEM)" htmlFor="certPem" className="sm:col-span-2">
                      <Textarea
                        id="certPem"
                        rows={5}
                        className="font-mono text-xs"
                        value={certPem}
                        onChange={(e) => setCertPem(e.target.value)}
                        placeholder={
                          proxy.hasCustomCert
                            ? "colar de novo para substituir"
                            : "-----BEGIN CERTIFICATE-----"
                        }
                        required={!proxy.hasCustomCert}
                      />
                    </Field>
                    <Field label="Chave privada (PEM)" htmlFor="keyPem" className="sm:col-span-2">
                      <Textarea
                        id="keyPem"
                        rows={5}
                        className="font-mono text-xs"
                        value={keyPem}
                        onChange={(e) => setKeyPem(e.target.value)}
                        placeholder={
                          proxy.hasCustomCert
                            ? "colar de novo para substituir"
                            : "-----BEGIN PRIVATE KEY-----"
                        }
                        required={!proxy.hasCustomCert}
                      />
                    </Field>
                  </>
                ) : null}
                {(
                  [
                    ["forceHttps", "Forçar HTTPS"],
                    ["websocket", "WebSocket"],
                    ["gzip", "Gzip"],
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
                <Field label="Redirecionar www" htmlFor="wwwRedirect">
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
                <Field label="Body máximo (MB)" htmlFor="clientMaxBodyMb">
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
