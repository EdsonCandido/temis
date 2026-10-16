import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AppRow, type Host } from "@/api";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

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
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
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
      setSourceType("docker");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "falha ao cadastrar");
    }
  }

  return (
    <>
      <PageHeader
        kicker="carga útil"
        title="Aplicações"
        description="Imagem Docker (registry) ou repositório GitHub. Domínio vira vhost nginx + certificado."
      />

      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {hosts.length === 0 ? (
        <Alert variant="warning" className="mb-6">
          <AlertDescription>
            Cadastre um host primeiro.{" "}
            <Link className="underline" to="/hosts">
              Ir para Hosts
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar aplicação</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
              <Field label="host" htmlFor="hostId" className="sm:col-span-2">
                <SelectNative id="hostId" name="hostId" required disabled={hosts.length === 0}>
                  {hosts.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </SelectNative>
              </Field>
              <Field label="nome" htmlFor="name">
                <Input id="name" name="name" required placeholder="atlas-web" />
              </Field>
              <Field label="domínio público" htmlFor="domain">
                <Input id="domain" name="domain" required placeholder="app.seudominio.com" />
              </Field>
              <Field label="origem" htmlFor="sourceType" className="sm:col-span-2">
                <SelectNative
                  id="sourceType"
                  value={sourceType}
                  onChange={(e) => setSourceType(e.target.value as "docker" | "github")}
                >
                  <option value="docker">imagem Docker (ghcr / docker hub / registry)</option>
                  <option value="github">repositório GitHub</option>
                </SelectNative>
              </Field>
              <Field label="URL" htmlFor="sourceUrl" className="sm:col-span-2">
                <Input
                  id="sourceUrl"
                  name="sourceUrl"
                  required
                  placeholder={sourceType === "docker" ? "nginx:alpine" : "https://github.com/org/repo"}
                />
              </Field>
              {sourceType === "github" ? (
                <>
                  <Field label="branch / tag" htmlFor="githubRef">
                    <Input id="githubRef" name="githubRef" defaultValue="main" />
                  </Field>
                  <Field label="Dockerfile" htmlFor="dockerfilePath">
                    <Input id="dockerfilePath" name="dockerfilePath" defaultValue="Dockerfile" />
                  </Field>
                </>
              ) : null}
              <Field label="porta interna do container" htmlFor="internalPort">
                <Input id="internalPort" name="internalPort" type="number" defaultValue={80} required />
              </Field>
              <Field label="variáveis de ambiente" htmlFor="envText" className="sm:col-span-2">
                <Textarea id="envText" name="envText" rows={4} placeholder="KEY=valor, uma por linha" />
              </Field>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={hosts.length === 0}>
                  Cadastrar app
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Aplicações</CardTitle>
          </CardHeader>
          <CardContent>
            {apps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma aplicação cadastrada.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>app</TableHead>
                    <TableHead>domínio</TableHead>
                    <TableHead>origem</TableHead>
                    <TableHead>status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {apps.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link className="font-medium text-primary underline-offset-4 hover:underline" to={`/apps/${a.id}`}>
                          {a.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{a.domain}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">
                        {a.sourceType}: {a.sourceUrl}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
