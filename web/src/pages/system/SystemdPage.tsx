import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/api";
import { toast } from "@/lib/toast";
import { HostPicker } from "@/components/host-picker";
import { PageHeader } from "@/components/page-header";
import { useModuleHost } from "@/hooks/use-module-host";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Unit = {
  unit: string;
  load: string;
  active: string;
  sub: string;
  description: string;
  enabled: string;
};

type Payload = {
  available: boolean;
  units: Unit[];
  message: string | null;
};

type Action = "start" | "stop" | "restart" | "enable" | "disable";

export function SystemdPage() {
  const { hosts, hostId, setHostId, error: hostError } = useModuleHost();
  const [data, setData] = useState<Payload | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!hostId) return;
    setError("");
    try {
      setData(await api<Payload>(`/api/modules/systemd?hostId=${hostId}`));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "falha ao listar serviços");
    }
  }, [hostId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function act(unit: string, action: Action) {
    if (!hostId) return;
    setBusy(`${unit}:${action}`);
    setError("");
    try {
      await api("/api/modules/systemd/action", {
        method: "POST",
        body: JSON.stringify({ hostId, unit, action }),
      });
      toast.success(`${action} em ${unit}.`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ação falhou");
    } finally {
      setBusy(null);
    }
  }

  const rows = useMemo(() => {
    const list = data?.units ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (u) =>
        u.unit.toLowerCase().includes(needle) ||
        u.description.toLowerCase().includes(needle) ||
        u.active.toLowerCase().includes(needle),
    );
  }, [data, q]);

  return (
    <>
      <PageHeader
        title="Serviços Systemd"
        description="Lista unidades .service no host. start, stop, restart, enable e disable."
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

      {data && !data.available ? (
        <Alert className="mb-6">
          <AlertDescription>{data.message ?? "systemctl não existe neste host."}</AlertDescription>
        </Alert>
      ) : null}

      {data?.available ? (
        <Card>
          <CardContent className="pt-6">
            <div className="mb-4 w-full min-w-0 sm:max-w-sm">
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar unidade ou descrição"
                aria-label="Filtrar serviços"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Ativo</TableHead>
                  <TableHead>Sub</TableHead>
                  <TableHead>Habilitado</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((u) => (
                  <TableRow key={u.unit}>
                    <TableCell className="font-mono text-xs">{u.unit}</TableCell>
                    <TableCell>
                      <Badge variant={u.active === "active" ? "success" : u.active === "failed" ? "danger" : "secondary"}>
                        {u.active}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.sub}</TableCell>
                    <TableCell className="text-muted-foreground">{u.enabled}</TableCell>
                    <TableCell className="max-w-[28ch] truncate text-muted-foreground">{u.description}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap justify-end gap-1">
                        {(["start", "stop", "restart", "enable", "disable"] as Action[]).map((action) => (
                          <Button
                            key={action}
                            variant="outline"
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => act(u.unit, action)}
                          >
                            {busy === `${u.unit}:${action}` ? "…" : action}
                          </Button>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {rows.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nenhuma unidade neste filtro.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
