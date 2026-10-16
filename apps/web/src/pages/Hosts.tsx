import { FormEvent, useEffect, useState } from "react";
import { api, type Host } from "@/api";
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
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export function Hosts() {
  const [list, setList] = useState<Host[]>([]);
  const [kind, setKind] = useState<"local" | "ssh">("local");
  const [msg, setMsg] = useState("");
  const [msgTone, setMsgTone] = useState<"success" | "destructive" | "warning">("success");
  const [pendingDelete, setPendingDelete] = useState<Host | null>(null);

  async function load() {
    setList(await api<Host[]>("/api/hosts"));
  }

  useEffect(() => {
    load().catch((e) => {
      setMsgTone("destructive");
      setMsg(e.message);
    });
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
    try {
      await api("/api/hosts", { method: "POST", body: JSON.stringify(body) });
      e.currentTarget.reset();
      setKind("local");
      setMsgTone("success");
      setMsg("Host cadastrado.");
      await load();
    } catch (err) {
      setMsgTone("destructive");
      setMsg(err instanceof Error ? err.message : "falha ao cadastrar");
    }
  }

  return (
    <>
      <PageHeader
        kicker="máquinas"
        title="Hosts"
        description="Local = Temis na mesma máquina. SSH = Temis controla a VPS à distância."
      />

      {msg ? (
        <Alert variant={msgTone} className="mb-6">
          <AlertDescription>{msg}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Cadastrar host</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="grid gap-4">
              <Field label="nome" htmlFor="name">
                <Input id="name" name="name" required placeholder="vps-prod" />
              </Field>
              <Field label="tipo" htmlFor="kind">
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
                  <Field label="host SSH" htmlFor="sshHost">
                    <Input id="sshHost" name="sshHost" placeholder="203.0.113.10" required />
                  </Field>
                  <Field label="porta" htmlFor="sshPort">
                    <Input id="sshPort" name="sshPort" type="number" defaultValue={22} />
                  </Field>
                  <Field label="usuário" htmlFor="sshUser">
                    <Input id="sshUser" name="sshUser" placeholder="root" required />
                  </Field>
                  <Field label="caminho da chave privada" htmlFor="sshKeyPath">
                    <Input id="sshKeyPath" name="sshKeyPath" placeholder="/Users/voce/.ssh/id_ed25519" />
                  </Field>
                </>
              ) : null}
              <Button type="submit">Cadastrar host</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Hosts cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {list.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum host ainda. Cadastre o primeiro à esquerda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>nome</TableHead>
                    <TableHead>tipo</TableHead>
                    <TableHead>alvo</TableHead>
                    <TableHead className="text-right">ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="font-medium">{h.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{h.kind}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {h.kind === "ssh" ? `${h.sshUser}@${h.sshHost}:${h.sshPort}` : "localhost"}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={async () => {
                              try {
                                const r = await api<{ docker: string }>(`/api/hosts/${h.id}/test`, {
                                  method: "POST",
                                });
                                setMsgTone("success");
                                setMsg(`Docker ${r.docker} em ${h.name}`);
                              } catch (e) {
                                setMsgTone("destructive");
                                setMsg(e instanceof Error ? e.message : "falha");
                              }
                            }}
                          >
                            testar Docker
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => setPendingDelete(h)}>
                            remover
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                await api(`/api/hosts/${pendingDelete.id}`, { method: "DELETE" });
                setPendingDelete(null);
                setMsgTone("success");
                setMsg("Host removido.");
                await load();
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
