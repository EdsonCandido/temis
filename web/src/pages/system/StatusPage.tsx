import { useCallback, useEffect, useState } from "react";
import { api } from "@/api";
import { HostPicker } from "@/components/host-picker";
import { PageHeader } from "@/components/page-header";
import { useModuleHost } from "@/hooks/use-module-host";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type Level = "ok" | "warn" | "down";

type Monitor = {
  id: string;
  name: string;
  kind: string;
  level: Level;
  detail: string;
};

type StatusPayload = {
  hostName: string;
  checkedAt: number;
  monitors: Monitor[];
};

const badge: Record<Level, "success" | "warning" | "danger"> = {
  ok: "success",
  warn: "warning",
  down: "danger",
};

const label: Record<Level, string> = {
  ok: "ok",
  warn: "alerta",
  down: "fora",
};

export function StatusPage() {
  const { hosts, hostId, setHostId, error: hostError } = useModuleHost();
  const [data, setData] = useState<StatusPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!hostId) return;
    setLoading(true);
    setError("");
    try {
      setData(await api<StatusPayload>(`/api/modules/status?hostId=${hostId}`));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "falha ao checar status");
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  const down = data?.monitors.filter((m) => m.level === "down").length ?? 0;
  const warn = data?.monitors.filter((m) => m.level === "warn").length ?? 0;

  return (
    <>
      <PageHeader
        title="Status do sistema e servidores"
        description="Checagens do host escolhido: carga, memória, disco, Docker e aplicações."
        actions={
          <>
            <HostPicker hosts={hosts} hostId={hostId} onChange={setHostId} />
            <Button className="w-full sm:w-auto" variant="outline" onClick={load} disabled={!hostId || loading}>
              {loading ? "Checando…" : "Checar agora"}
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

      {data ? (
        <Card>
          <CardContent className="pt-6">
            <p className="mb-4 text-sm text-muted-foreground">
              {data.hostName}
              {" · "}
              {down} fora, {warn} alerta
              {" · "}
              {new Date(data.checkedAt).toLocaleString("pt-BR")}
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Monitor</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Detalhe</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.monitors.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.kind}</TableCell>
                    <TableCell>
                      <Badge variant={badge[m.level]}>{label[m.level]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.detail}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
