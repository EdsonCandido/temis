import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/api";
import { toast } from "@/lib/toast";
import { HostPicker } from "@/components/host-picker";
import { PageHeader } from "@/components/page-header";
import { useModuleHost } from "@/hooks/use-module-host";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ProcessRow = {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  rssKb: number;
  elapsed: string;
  stat: string;
  command: string;
};

type Signal = "TERM" | "KILL";

export function ProcPage() {
  const { hosts, hostId, setHostId, error: hostError } = useModuleHost();
  const [processes, setProcesses] = useState<ProcessRow[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hostId) return;
    setError("");
    try {
      const r = await api<{ processes: ProcessRow[] }>(`/api/modules/proc?hostId=${hostId}`);
      setProcesses(r.processes);
    } catch (e) {
      setProcesses([]);
      setError(e instanceof Error ? e.message : "falha ao listar processos");
    }
  }, [hostId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function send(pid: number, signal: Signal) {
    if (!hostId) return;
    setBusy(`${pid}:${signal}`);
    setError("");
    try {
      await api("/api/modules/proc/signal", {
        method: "POST",
        body: JSON.stringify({ hostId, pid, signal }),
      });
      toast.success(`Sinal ${signal} enviado ao PID ${pid}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "sinal falhou");
    } finally {
      setBusy(null);
    }
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return processes;
    return processes.filter(
      (p) => p.command.toLowerCase().includes(needle) || p.user.toLowerCase().includes(needle) || String(p.pid).includes(needle),
    );
  }, [processes, q]);

  return (
    <>
      <PageHeader
        title="Processos em execução"
        description="Lista processos do host, ordenados por CPU. TERM e KILL recusam PID 1."
        actions={
          <>
            <HostPicker hosts={hosts} hostId={hostId} onChange={setHostId} />
            <Button className="w-full sm:w-auto" variant="outline" onClick={load} disabled={!hostId}>
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
            <div className="mb-4 w-full min-w-0 sm:max-w-sm">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar PID, usuário ou comando"
                aria-label="Filtrar processos"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">PID</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead className="text-right">CPU %</TableHead>
                  <TableHead className="text-right">MEM %</TableHead>
                  <TableHead className="text-right">RSS</TableHead>
                  <TableHead>Tempo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Comando</TableHead>
                  <TableHead className="text-right">Sinal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((p) => (
                  <TableRow key={p.pid}>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{p.pid}</TableCell>
                    <TableCell>{p.user}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.cpu.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums">{p.mem.toFixed(1)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {p.rssKb >= 1024 ? `${(p.rssKb / 1024).toFixed(0)} MB` : `${p.rssKb} KB`}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{p.elapsed}</TableCell>
                    <TableCell className="text-muted-foreground">{p.stat}</TableCell>
                    <TableCell className="max-w-[28ch] truncate font-mono text-xs">{p.command}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy !== null || p.pid < 2}
                          onClick={() => send(p.pid, "TERM")}
                        >
                          {busy === `${p.pid}:TERM` ? "…" : "TERM"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={busy !== null || p.pid < 2}
                          onClick={() => send(p.pid, "KILL")}
                        >
                          {busy === `${p.pid}:KILL` ? "…" : "KILL"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nenhum processo neste filtro.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
