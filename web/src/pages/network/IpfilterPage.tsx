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

type Rule = { side: "in" | "out" | "other"; line: string };

type Payload = {
  available: boolean;
  version: string;
  rules: Rule[];
  message: string | null;
};

export function IpfilterPage() {
  const { hosts, hostId, setHostId, error: hostError } = useModuleHost();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!hostId) return;
    setLoading(true);
    setError("");
    try {
      setData(await api<Payload>(`/api/modules/ipfilter?hostId=${hostId}`));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "falha ao ler ipfilter");
    } finally {
      setLoading(false);
    }
  }, [hostId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  return (
    <>
      <PageHeader
        title="IPFilter"
        description="Regras ativas via ipfstat no host. Típico de BSD/Solaris; em Linux o módulo costuma estar ausente."
        actions={
          <>
            <HostPicker hosts={hosts} hostId={hostId} onChange={setHostId} />
            <Button className="w-full sm:w-auto" variant="outline" onClick={load} disabled={!hostId || loading}>
              {loading ? "Lendo…" : "Atualizar"}
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
          <AlertDescription>{data.message ?? "ipf/ipfstat não existe neste host."}</AlertDescription>
        </Alert>
      ) : null}

      {data?.available ? (
        <Card>
          <CardContent className="pt-6">
            {data.version ? <p className="mb-4 text-sm text-muted-foreground">{data.version}</p> : null}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lado</TableHead>
                  <TableHead>Regra</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rules.map((r, i) => (
                  <TableRow key={`${r.side}-${i}`}>
                    <TableCell>
                      <Badge variant="secondary">{r.side}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs whitespace-pre-wrap">{r.line}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {data.rules.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Nenhuma regra ativa no ipfstat.</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
