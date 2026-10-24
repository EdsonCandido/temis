import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AppRow, type Host, type Metrics } from "@/api";
import { AppsDonut } from "@/components/charts/apps-donut";
import { ContainerBarChart } from "@/components/charts/container-bar-chart";
import { ContainersOriginDonut } from "@/components/charts/containers-origin-donut";
import { ContainersStateDonut } from "@/components/charts/containers-state-donut";
import { FleetBars } from "@/components/charts/fleet-bars";
import { GaugeChart } from "@/components/charts/gauge-chart";
import { HealthLegend } from "@/components/health-legend";
import { PageHeader } from "@/components/page-header";
import { KpiStrip, StatCard } from "@/components/stat-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type OverviewData = {
  hosts: Array<{ host: Host; metrics?: Metrics; error?: string }>;
  apps: AppRow[];
};

function loadPressure(metrics: Metrics): number {
  if (!metrics.cpuCount) return 0;
  return Math.round(Math.min(100, (metrics.load1 / metrics.cpuCount) * 1000)) / 10;
}

function statusLabel(status: string): string {
  if (!status) return "sem estado";
  return status;
}

export function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<OverviewData>("/api/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const running = data.apps.filter((a) => a.status === "running").length;
  const dockerOk = data.hosts.filter((h) => h.metrics?.dockerOk).length;
  const allContainers = data.hosts.flatMap((h) =>
    (h.metrics?.containers ?? []).map((c) => ({ ...c, hostName: h.host.name })),
  );
  const knownContainers = allContainers.filter((c) => c.known).length;
  const unknownContainers = allContainers.filter((c) => !c.known).length;
  const runningContainers = allContainers.filter((c) => /running|up/i.test(c.status)).length;
  const finding =
    data.apps.length === 0
      ? "Nenhuma aplicação cadastrada ainda."
      : `${running} de ${data.apps.length} no ar. Meta: uso de memória e disco abaixo de 70%.`;

  return (
    <>
      <PageHeader
        title="Painel"
        description={finding}
        actions={
          <Button asChild variant="outline">
            <Link to="/apps">Ver aplicações</Link>
          </Button>
        }
      />

      <KpiStrip>
        <StatCard label="Hosts" value={data.hosts.length} />
        <StatCard label="Apps" value={data.apps.length} />
        <StatCard label="No ar" value={running} hint={`${running} de ${data.apps.length} running`} />
        <StatCard label="Docker ok" value={dockerOk} hint={`${dockerOk} de ${data.hosts.length} hosts`} />
      </KpiStrip>

      <KpiStrip>
        <StatCard label="Containers" value={allContainers.length} hint="docker ps -a em todos os hosts" />
        <StatCard label="Do Têmis" value={knownContainers} hint="cadastrados neste painel" />
        <StatCard
          label="Não conhecidos"
          value={unknownContainers}
          hint="rodam no host, sem cadastro"
          tone={unknownContainers > 0 ? "default" : "success"}
        />
        <StatCard label="Containers no ar" value={runningContainers} hint={`${runningContainers} de ${allContainers.length} running`} />
      </KpiStrip>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Status das aplicações</CardTitle>
          </CardHeader>
          <CardContent>
            <AppsDonut statuses={data.apps.map((a) => a.status)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Saúde da frota</CardTitle>
          </CardHeader>
          <CardContent>
            <HealthLegend />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Origem dos containers</CardTitle>
            <CardDescription>O que o Têmis gerencia versus o que só aparece no Docker do host.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContainersOriginDonut known={knownContainers} unknown={unknownContainers} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recursos por host</CardTitle>
            <CardDescription>Memória, disco e carga (load dividido pelos núcleos).</CardDescription>
          </CardHeader>
          <CardContent>
            <FleetBars
              hosts={data.hosts
                .filter((item) => item.metrics)
                .map((item) => ({
                  name: item.host.name,
                  mem: item.metrics!.memPercent,
                  disk: item.metrics!.diskPercent,
                  load: loadPressure(item.metrics!),
                }))}
            />
          </CardContent>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estado dos containers</CardTitle>
            <CardDescription>Todos os containers do Docker, cadastrados ou não.</CardDescription>
          </CardHeader>
          <CardContent>
            <ContainersStateDonut statuses={allContainers.map((c) => c.status)} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Não conhecidos pelo Têmis</CardTitle>
            <CardDescription>Rodam no host, mas não são aplicação cadastrada neste painel.</CardDescription>
          </CardHeader>
          <CardContent>
            {unknownContainers === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
                Nenhum container fora do cadastro.
              </p>
            ) : (
              <ul className="space-y-2">
                {allContainers
                  .filter((c) => !c.known)
                  .map((c) => (
                    <li
                      key={`${c.hostName}-${c.name}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="font-mono text-xs">{c.name}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{c.hostName}</span>
                      </span>
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge variant="warning">Não conhecida pelo Têmis</Badge>
                        <span className="text-muted-foreground">{statusLabel(c.status)}</span>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {data.hosts.map((item) => (
          <Card key={item.host.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{item.host.name}</CardTitle>
                <p className="mt-1 font-mono text-xs text-muted-foreground">
                  {item.metrics?.hostname ?? item.host.name}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{item.host.kind}</Badge>
                {item.metrics ? (
                  <Badge variant={item.metrics.dockerOk ? "success" : "danger"}>
                    Docker {item.metrics.dockerOk ? "ok" : "off"}
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {item.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{item.error}</AlertDescription>
                </Alert>
              ) : null}
              {item.metrics ? (
                <>
                  <div className="grid gap-5 md:grid-cols-3">
                    <GaugeChart
                      label="Memória"
                      percent={item.metrics.memPercent}
                      detail={`${item.metrics.memUsedMb} / ${item.metrics.memTotalMb} MB`}
                    />
                    <GaugeChart
                      label="Disco"
                      percent={item.metrics.diskPercent}
                      detail={`${item.metrics.diskUsedGb} / ${item.metrics.diskTotalGb} GB`}
                    />
                    <GaugeChart
                      label="Carga da CPU"
                      percent={loadPressure(item.metrics)}
                      detail={`${item.metrics.cpuCount} núcleos · load 1m ${item.metrics.load1}`}
                    />
                  </div>
                  <div>
                    <h2 className="mb-3 text-base font-medium">Containers (CPU / mem)</h2>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Azul = aplicação do Têmis. Cinza/âmbar = container não conhecido.
                    </p>
                    <ContainerBarChart containers={item.metrics.containers} />
                  </div>
                  <div>
                    <h2 className="mb-3 text-base font-medium">Todos os containers do host</h2>
                    <p className="mb-3 text-sm text-muted-foreground">
                      Lista completa do Docker. Containers sem cadastro no Têmis ficam marcados como não conhecidos.
                    </p>
                    {item.metrics.containers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum container neste host.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Origem</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>CPU</TableHead>
                            <TableHead>Memória</TableHead>
                            <TableHead>Imagem</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {item.metrics.containers.map((c) => (
                            <TableRow key={c.name}>
                              <TableCell className="font-mono text-xs">{c.name}</TableCell>
                              <TableCell>
                                {c.known ? (
                                  <Badge variant="success">{c.appName ?? "Têmis"}</Badge>
                                ) : (
                                  <Badge variant="warning">Não conhecida pelo Têmis</Badge>
                                )}
                              </TableCell>
                              <TableCell>{statusLabel(c.status)}</TableCell>
                              <TableCell className="num">{c.cpu || "—"}</TableCell>
                              <TableCell className="num">{c.mem || c.memPercent || "—"}</TableCell>
                              <TableCell className="max-w-48 truncate font-mono text-xs text-muted-foreground" title={c.image}>
                                {c.image || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
