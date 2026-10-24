import { useCallback, useEffect, useState } from "react";
import { api } from "@/api";
import { toast } from "@/lib/toast";
import { HostPicker } from "@/components/host-picker";
import { PageHeader } from "@/components/page-header";
import { useModuleHost } from "@/hooks/use-module-host";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Entry = {
  name: string;
  kind: "dir" | "file" | "link" | "other";
  size: number;
  mtime: number;
  mode: string;
};

type Listing = { path: string; entries: Entry[] };
type FileView = { path: string; size: number; truncated: boolean; content: string };

const NAME_RE = /^[A-Za-z0-9._-]+$/;

function joinPath(dir: string, name: string) {
  return dir === "/" ? `/${name}` : `${dir}/${name}`;
}

function parentPath(path: string) {
  if (path === "/") return "/";
  const i = path.lastIndexOf("/");
  return i <= 0 ? "/" : path.slice(0, i);
}

function crumbItems(path: string) {
  const parts = path === "/" ? [] : path.split("/").filter(Boolean);
  const items = [{ label: "/", href: "/" }];
  let acc = "";
  for (const part of parts) {
    acc += `/${part}`;
    items.push({ label: part, href: acc });
  }
  return items;
}

function formatSize(n: number) {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}

export function FilesPage() {
  const { hosts, hostId, setHostId, error: hostError } = useModuleHost();
  const [path, setPath] = useState("/");
  const [draft, setDraft] = useState("/");
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newDir, setNewDir] = useState("");
  const [view, setView] = useState<FileView | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const loadPath = useCallback(
    async (next: string) => {
      if (!hostId) return;
      setError("");
      setBusy(true);
      try {
        const data = await api<Listing>(`/api/modules/filemin?hostId=${hostId}&path=${encodeURIComponent(next)}`);
        setListing(data);
        setPath(data.path);
        setDraft(data.path);
      } catch (e) {
        setListing(null);
        setError(e instanceof Error ? e.message : "falha ao listar diretório");
      } finally {
        setBusy(false);
      }
    },
    [hostId],
  );

  useEffect(() => {
    loadPath("/").catch(() => undefined);
  }, [loadPath]);

  async function openFile(full: string) {
    if (!hostId) return;
    setBusy(true);
    setError("");
    try {
      setView(await api<FileView>(`/api/modules/filemin/read?hostId=${hostId}&path=${encodeURIComponent(full)}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : "falha ao ler arquivo");
    } finally {
      setBusy(false);
    }
  }

  async function createDir() {
    if (!hostId) return;
    const name = newDir.trim();
    if (!NAME_RE.test(name)) {
      setError("Nome de pasta só aceita letras, números, ponto, _ e -");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api("/api/modules/filemin/mkdir", {
        method: "POST",
        body: JSON.stringify({ hostId, path: joinPath(path, name) }),
      });
      toast.success(`Pasta ${name} criada.`);
      setNewDir("");
      await loadPath(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "mkdir falhou");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!hostId || !pendingDelete) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/modules/filemin/delete", {
        method: "POST",
        body: JSON.stringify({ hostId, path: pendingDelete }),
      });
      toast.success(`${pendingDelete} removido.`);
      setPendingDelete(null);
      await loadPath(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "remoção falhou");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Gerenciador de arquivos"
        description="Lista diretórios do host, lê texto até 200 KB e remove arquivo ou pasta vazia."
        actions={
          <>
            <HostPicker hosts={hosts} hostId={hostId} onChange={setHostId} />
            <Button className="w-full sm:w-auto" variant="outline" onClick={() => loadPath(path)} disabled={!hostId || busy}>
              Atualizar
            </Button>
          </>
        }
      />

      {hostError || error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{hostError || error}</AlertDescription>
        </Alert>
      ) : null}

      {!hostId && !hostError ? (
        <p className="text-sm text-muted-foreground">Cadastre um host em Hosts para usar este módulo.</p>
      ) : null}

      {hostId ? (
        <Card>
          <CardContent className="pt-6">
            <form
              className="mb-4 grid w-full min-w-0 gap-3 sm:flex sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                loadPath(draft.trim() || "/").catch(() => undefined);
              }}
            >
              <div className="grid min-w-0 flex-1 gap-1.5">
                <Label htmlFor="file-path">Caminho</Label>
                <Input
                  id="file-path"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  className="font-mono text-xs"
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto" variant="outline" disabled={busy}>
                Abrir
              </Button>
            </form>

            <nav aria-label="Caminho atual" className="mb-4 flex flex-wrap gap-1 text-sm">
              {crumbItems(path).map((item, i) => (
                <span key={`${item.href}-${i}`} className="flex items-center gap-1">
                  {i > 1 ? <span className="text-muted-foreground">/</span> : null}
                  <button
                    type="button"
                    className="text-primary underline-offset-2 hover:underline"
                    onClick={() => loadPath(item.href).catch(() => undefined)}
                  >
                    {item.label}
                  </button>
                </span>
              ))}
            </nav>

            <form
              className="mb-4 grid w-full min-w-0 gap-3 sm:flex sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                createDir().catch(() => undefined);
              }}
            >
              <div className="grid w-full min-w-0 gap-1.5 sm:max-w-sm">
                <Label htmlFor="file-mkdir">Nova pasta</Label>
                <Input
                  id="file-mkdir"
                  value={newDir}
                  onChange={(e) => setNewDir(e.target.value)}
                  placeholder="backup"
                />
              </div>
              <Button type="submit" className="w-full sm:w-auto" disabled={busy || !newDir.trim()}>
                Criar pasta
              </Button>
            </form>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Tamanho</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Modificado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {path !== "/" ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <Button variant="ghost" size="sm" onClick={() => loadPath(parentPath(path)).catch(() => undefined)}>
                        .. (pasta pai)
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : null}
                {(listing?.entries ?? []).map((e) => {
                  const full = joinPath(path, e.name);
                  return (
                    <TableRow key={e.name}>
                      <TableCell className="font-mono text-xs">
                        {e.kind === "dir" ? (
                          <button
                            type="button"
                            className="text-left text-primary underline-offset-2 hover:underline"
                            onClick={() => loadPath(full).catch(() => undefined)}
                          >
                            {e.name}
                          </button>
                        ) : (
                          e.name
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{e.kind}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {e.kind === "file" ? formatSize(e.size) : "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{e.mode}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {e.mtime ? new Date(e.mtime * 1000).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1">
                          {e.kind === "file" ? (
                            <Button variant="outline" size="sm" disabled={busy} onClick={() => openFile(full)}>
                              Ver
                            </Button>
                          ) : null}
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={busy}
                            onClick={() => setPendingDelete(full)}
                          >
                            Excluir
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {listing && listing.entries.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Diretório vazio.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={view !== null} onOpenChange={(open) => !open && setView(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="break-all font-mono text-sm">{view?.path}</DialogTitle>
            <DialogDescription>
              {view?.truncated
                ? "Arquivo maior que 200 KB; mostrando só o início."
                : "Conteúdo em texto (bytes inválidos viram caractere de substituição)."}
            </DialogDescription>
          </DialogHeader>
          <Textarea readOnly value={view?.content ?? ""} className="min-h-64 font-mono text-xs" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setView(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir item?</DialogTitle>
            <DialogDescription>
              Remove <span className="font-mono">{pendingDelete}</span>. Pasta só some se estiver vazia. Não há
              lixeira.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => confirmDelete().catch(() => undefined)}>
              {busy ? "Excluindo…" : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
