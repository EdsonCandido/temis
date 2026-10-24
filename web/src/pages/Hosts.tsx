import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, EyeOff } from "lucide-react";
import { api, type Host } from "@/api";
import { toast } from "@/lib/toast";
import { Field } from "@/components/field";
import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type SortKey = "name" | "kind" | "target" | "auth";
type SortDir = "asc" | "desc";

function hostTarget(h: Host) {
  if (h.kind !== "ssh") return "localhost";
  return `${h.sshUser}@${h.sshHost}`;
}

function hostAuth(h: Host) {
  if (h.kind !== "ssh") return "";
  return [h.hasSshPassword ? "senha" : null, h.sshKeyPath ? "chave" : null].filter(Boolean).join(" + ");
}

function sortValue(h: Host, key: SortKey) {
  if (key === "name") return h.name.toLocaleLowerCase("pt-BR");
  if (key === "kind") return h.kind;
  if (key === "target") return hostTarget(h).toLocaleLowerCase("pt-BR");
  return hostAuth(h);
}

function SortButton({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  column: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === column;
  return (
    <button
      type="button"
      onClick={() => onSort(column)}
      aria-label={`Ordenar por ${label}`}
      className={`inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        align === "right" ? "ml-auto" : ""
      }`}
    >
      {label}
      {active ? (
        sortDir === "asc" ? (
          <ArrowUp className="h-3 w-3" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3" aria-hidden />
        )
      ) : null}
    </button>
  );
}

function HostActions({
  host,
  busy,
  onConnect,
  onDocker,
  onDelete,
}: {
  host: Host;
  busy: boolean;
  onConnect: (h: Host) => void;
  onDocker: (h: Host) => void;
  onDelete: (h: Host) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 md:flex md:flex-wrap md:justify-end">
      <Button
        variant="outline"
        size="sm"
        className="min-h-11 md:min-h-8"
        disabled={busy}
        onClick={() => onConnect(host)}
      >
        {busy ? "Testando…" : "Testar conexão"}
      </Button>
      <Button variant="outline" size="sm" className="min-h-11 md:min-h-8" onClick={() => onDocker(host)}>
        Testar Docker
      </Button>
      <Button variant="destructive" size="sm" className="min-h-11 md:min-h-8" onClick={() => onDelete(host)}>
        Remover
      </Button>
    </div>
  );
}

export function Hosts() {
  const [list, setList] = useState<Host[]>([]);
  const [kind, setKind] = useState<"local" | "ssh">("local");
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Host | null>(null);
  const [showSshPassword, setShowSshPassword] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  async function load() {
    setList(await api<Host[]>("/api/hosts"));
  }

  useEffect(() => {
    load().catch((e) => {
      setError(e instanceof Error ? e.message : "Falha ao listar hosts");
    });
  }, []);

  function onSort(key: SortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...list];
    copy.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [list, sortKey, sortDir]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      name: String(fd.get("name")),
      kind,
      sshHost: String(fd.get("sshHost") || "") || undefined,
      sshPort: Number(fd.get("sshPort") || 22),
      sshUser: String(fd.get("sshUser") || "") || undefined,
      sshPassword: String(fd.get("sshPassword") || "") || undefined,
      sshKeyPath: String(fd.get("sshKeyPath") || "") || undefined,
    };
    try {
      await api("/api/hosts", { method: "POST", body: JSON.stringify(body) });
      form.reset();
      setKind("local");
      setShowSshPassword(false);
      setError("");
      toast.success("Host cadastrado.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cadastrar");
    }
  }

  async function onConnect(h: Host) {
    setBusyId(h.id);
    try {
      const r = await api<{ hostname: string; user: string; ms: number }>(`/api/hosts/${h.id}/connect`, {
        method: "POST",
      });
      toast.success(`${h.name}: login ok · ${r.user}@${r.hostname} · ${r.ms} ms`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na conexão");
    } finally {
      setBusyId(null);
    }
  }

  async function onDocker(h: Host) {
    try {
      const r = await api<{ docker: string }>(`/api/hosts/${h.id}/test`, { method: "POST" });
      toast.success(`Docker ${r.docker} em ${h.name}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no Docker");
    }
  }

  return (
    <>
      <PageHeader
        title="Hosts"
        description="Local = Temis na mesma máquina. SSH = usuário, porta, host e senha. Chave é opcional."
      />

      {error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Cadastrar host</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4">
              <Field label="Nome" htmlFor="name">
                <Input id="name" name="name" required placeholder="vps-prod" autoComplete="off" spellCheck={false} />
              </Field>
              <Field label="Tipo" htmlFor="kind">
                <SelectNative
                  id="kind"
                  value={kind}
                  onChange={(e) => setKind(e.target.value as "local" | "ssh")}
                >
                  <option value="local">local (Docker nesta máquina)</option>
                  <option value="ssh">SSH (VPS remota)</option>
                </SelectNative>
              </Field>
              {kind === "ssh" ? (
                <>
                  <Field label="Host SSH" htmlFor="sshHost">
                    <Input
                      id="sshHost"
                      name="sshHost"
                      placeholder="203.0.113.10"
                      required
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Porta" htmlFor="sshPort">
                      <Input id="sshPort" name="sshPort" type="number" inputMode="numeric" defaultValue={22} />
                    </Field>
                    <Field label="Usuário" htmlFor="sshUser">
                      <Input id="sshUser" name="sshUser" placeholder="root" required autoComplete="username" spellCheck={false} />
                    </Field>
                  </div>
                  <Field label="Senha SSH" htmlFor="sshPassword">
                    <div className="relative">
                      <Input
                        id="sshPassword"
                        name="sshPassword"
                        type={showSshPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="senha do usuário"
                        className="pr-11"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0.5 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        onClick={() => setShowSshPassword((open) => !open)}
                        aria-label={showSshPassword ? "Ocultar senha" : "Mostrar senha"}
                        aria-pressed={showSshPassword}
                      >
                        {showSshPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </Field>
                  <Field label="Chave privada (opcional)" htmlFor="sshKeyPath">
                    <Input
                      id="sshKeyPath"
                      name="sshKeyPath"
                      placeholder="/Users/voce/.ssh/id_ed25519"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                </>
              ) : null}
              <Button type="submit">Cadastrar host</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="min-w-0">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Hosts cadastrados</CardTitle>
            {list.length > 0 ? (
              <p className="text-xs tabular-nums text-muted-foreground">
                {list.length} {list.length === 1 ? "host" : "hosts"}
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum host ainda. Cadastre o primeiro no formulário.</p>
            ) : (
              <>
                <div className="mb-4 flex items-end gap-2 md:hidden">
                  <div className="min-w-0 flex-1">
                    <Label htmlFor="host-sort">Ordenar</Label>
                    <SelectNative
                      id="host-sort"
                      className="mt-1.5"
                      value={sortKey}
                      onChange={(e) => onSort(e.target.value as SortKey)}
                    >
                      <option value="name">Nome</option>
                      <option value="kind">Tipo</option>
                      <option value="target">Alvo</option>
                      <option value="auth">Auth</option>
                    </SelectNative>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11 shrink-0"
                    onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                    aria-label={sortDir === "asc" ? "Ordem crescente. Inverter" : "Ordem decrescente. Inverter"}
                  >
                    <ArrowUpDown className="h-4 w-4" aria-hidden />
                    {sortDir === "asc" ? "A–Z" : "Z–A"}
                  </Button>
                </div>

                <ul className="grid gap-3 md:hidden">
                  {sorted.map((h) => (
                    <li key={h.id} className="rounded-lg border border-border px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{h.name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">{hostTarget(h)}</p>
                          {h.kind === "ssh" ? (
                            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">porta {h.sshPort}</p>
                          ) : null}
                        </div>
                        <Badge variant="outline">{h.kind}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{hostAuth(h) || "—"}</p>
                      <div className="mt-3">
                        <HostActions
                          host={h}
                          busy={busyId === h.id}
                          onConnect={onConnect}
                          onDocker={onDocker}
                          onDelete={setPendingDelete}
                        />
                      </div>
                    </li>
                  ))}
                </ul>

                <div className="hidden min-w-0 md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead aria-sort={sortKey === "name" ? (sortDir === "asc" ? "ascending" : "descending") : "none"} className="w-[32%]">
                          <SortButton label="Nome" column="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                        </TableHead>
                        <TableHead aria-sort={sortKey === "kind" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                          <SortButton label="Tipo" column="kind" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                        </TableHead>
                        <TableHead aria-sort={sortKey === "target" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                          <SortButton label="Alvo" column="target" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                        </TableHead>
                        <TableHead aria-sort={sortKey === "auth" ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                          <SortButton label="Auth" column="auth" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                        </TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sorted.map((h) => (
                        <TableRow key={h.id}>
                          <TableCell className="min-w-0 font-medium">
                            <span className="block truncate">{h.name}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{h.kind}</Badge>
                          </TableCell>
                          <TableCell className="min-w-0">
                            <p className="truncate font-mono text-xs">{hostTarget(h)}</p>
                            {h.kind === "ssh" ? (
                              <p className="text-xs tabular-nums text-muted-foreground">porta {h.sshPort}</p>
                            ) : (
                              <p className="text-xs text-muted-foreground">esta máquina</p>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{hostAuth(h) || "—"}</TableCell>
                          <TableCell>
                            <HostActions
                              host={h}
                              busy={busyId === h.id}
                              onConnect={onConnect}
                              onDocker={onDocker}
                              onDelete={setPendingDelete}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remover host?</DialogTitle>
            <DialogDescription>
              Isso remove o cadastro de {pendingDelete?.name}. Apps nesse host podem ficar órfãs.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!pendingDelete) return;
                try {
                  await api(`/api/hosts/${pendingDelete.id}`, { method: "DELETE" });
                  setPendingDelete(null);
                  toast.success(`Host ${pendingDelete.name} removido.`);
                  await load();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Falha ao remover host");
                }
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
