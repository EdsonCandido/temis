import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/api";
import { toast } from "@/lib/toast";
import { HostPicker } from "@/components/host-picker";
import { PageHeader } from "@/components/page-header";
import { useModuleHost } from "@/hooks/use-module-host";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Jail = {
  name: string;
  currentlyFailed: number;
  totalFailed: number;
  currentlyBanned: number;
  totalBanned: number;
  banned: string[];
};

type Payload = {
  available: boolean;
  installed: boolean;
  reason: "missing" | "stopped" | null;
  jails: Jail[];
  message: string | null;
};

export function Fail2banPage() {
  const { hosts, hostId, setHostId, error: hostError } = useModuleHost();
  const [data, setData] = useState<Payload | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmSetup, setConfirmSetup] = useState(false);

  const load = useCallback(async () => {
    if (!hostId) return;
    setError("");
    try {
      setData(await api<Payload>(`/api/modules/fail2ban?hostId=${hostId}`));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "falha ao listar jails");
    }
  }, [hostId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function unban(jail: string, ip: string) {
    if (!hostId) return;
    setBusy(`${jail}:${ip}`);
    setError("");
    try {
      await api("/api/modules/fail2ban/unban", {
        method: "POST",
        body: JSON.stringify({ hostId, jail, ip }),
      });
      toast.success(`${ip} liberado em ${jail}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "unban falhou");
    } finally {
      setBusy(null);
    }
  }

  async function setup() {
    if (!hostId) return;
    setBusy("setup");
    setError("");
    try {
      const r = await api<{ ignoreIps: string[] }>("/api/modules/fail2ban/setup", {
        method: "POST",
        body: JSON.stringify({ hostId }),
      });
      toast.success(
        r.ignoreIps?.length
          ? `Fail2Ban pronto. IPs ignorados: ${r.ignoreIps.join(", ")}.`
          : "Fail2Ban pronto. Jail sshd ligada.",
      );
      setConfirmSetup(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "instalação do Fail2Ban falhou");
    } finally {
      setBusy(null);
    }
  }

  const rows = useMemo(() => {
    const list = data?.jails ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (j) => j.name.toLowerCase().includes(needle) || j.banned.some((ip) => ip.includes(needle)),
    );
  }, [data, q]);

  const setupLabel = data?.reason === "stopped" ? "Iniciar e aplicar configuração básica" : "Instalar e aplicar configuração básica";

  return (
    <>
      <PageHeader
        title="Fail2Ban"
        description="Proteção ativa contra força bruta. Jails do host e IPs banidos, em detalhe."
        actions={
          <>
            <HostPicker hosts={hosts} hostId={hostId} onChange={setHostId} />
            <Button className="w-full sm:w-auto" variant="outline" onClick={load} disabled={!hostId}>
              Atualizar
            </Button>
          </>
        }
      />

      {hostId ? (
        <Alert variant="info" className="mb-6">
          <AlertTitle>Fail2Ban é necessário neste host</AlertTitle>
          <AlertDescription className="max-w-[65ch] space-y-2">
            <p>
              Ele observa falhas de autenticação (em especial SSH) e bloqueia o IP por um tempo. Sem isso, tentativas
              repetidas de senha seguem sem resposta automática.
            </p>
            <p>
              Esta tela mostra o estado ativo: jails ligadas, falhas e IPs banidos. Liberar um IP não apaga o histórico
              de falhas.
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {hostError || error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{hostError || error}</AlertDescription>
        </Alert>
      ) : null}

      {!hostId && !hostError ? (
        <p className="text-sm text-muted-foreground">Cadastre um host em Hosts para usar este módulo.</p>
      ) : null}

      {data && !data.available ? (
        <Alert variant="warning" className="mb-6">
          <AlertTitle>{data.reason === "stopped" ? "Serviço parado" : "Fail2Ban ausente"}</AlertTitle>
          <AlertDescription className="max-w-[65ch] space-y-3">
            <p>{data.message}</p>
            <p>
              A configuração básica liga só a jail <span className="font-mono text-xs">sshd</span>, com 8 tentativas em
              10 minutos e banimento de 1 hora. Ignora localhost e o IP que o Temis usa para chegar neste host — o
              painel não se bloqueia.
            </p>
            <Button
              className="w-full sm:w-auto"
              disabled={busy !== null}
              onClick={() => setConfirmSetup(true)}
            >
              {setupLabel}
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {data?.available ? (
        <>
          <Alert variant="success" className="mb-6">
            <AlertTitle>Fail2Ban ativo</AlertTitle>
            <AlertDescription className="max-w-[65ch]">
              O serviço está em execução neste host. Os números abaixo são o estado atual das jails, não um histórico
              completo.
            </AlertDescription>
          </Alert>
          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 w-full min-w-0 sm:max-w-sm">
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Filtrar jail ou IP"
                  aria-label="Filtrar jails"
                />
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Jail</TableHead>
                    <TableHead className="text-right">Falhas</TableHead>
                    <TableHead className="text-right">Banidos</TableHead>
                    <TableHead>IPs</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((j) => (
                    <TableRow key={j.name}>
                      <TableCell className="font-mono text-xs">{j.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {j.currentlyFailed} / {j.totalFailed}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {j.currentlyBanned} / {j.totalBanned}
                      </TableCell>
                      <TableCell>
                        {j.banned.length === 0 ? (
                          <span className="text-sm text-muted-foreground">Nenhum IP banido</span>
                        ) : (
                          <ul className="flex flex-col gap-2">
                            {j.banned.map((ip) => (
                              <li key={ip} className="flex flex-wrap items-center gap-2">
                                <Badge variant="secondary">{ip}</Badge>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={busy !== null}
                                  onClick={() => unban(j.name, ip)}
                                >
                                  {busy === `${j.name}:${ip}` ? "…" : "Liberar"}
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rows.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">Nenhuma jail neste filtro.</p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}

      <Dialog open={confirmSetup} onOpenChange={setConfirmSetup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{data?.reason === "stopped" ? "Iniciar Fail2Ban" : "Instalar Fail2Ban"}</DialogTitle>
            <DialogDescription className="space-y-2">
              <span className="block">
                Instala o pacote se faltar, grava <span className="font-mono text-xs">jail.d/temis.local</span> e liga o
                serviço. Só a jail sshd entra; o firewall não muda.
              </span>
              <span className="block">
                localhost e o IP do painel entram em ignoreip, para o Temis não perder SSH neste host.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSetup(false)} disabled={busy === "setup"}>
              Cancelar
            </Button>
            <Button onClick={setup} disabled={busy === "setup"}>
              {busy === "setup" ? "Aplicando…" : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
