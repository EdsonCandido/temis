import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AppRow, type Host, type Metrics } from "@/api";
import { AppsDonut } from "@/components/charts/apps-donut";
import { ContainerBarChart } from "@/components/charts/container-bar-chart";
import { GaugeChart } from "@/components/charts/gauge-chart";
import { HealthLegend } from "@/components/health-legend";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type OverviewData = {
  hosts: Array<{ host: Host; metrics?: Metrics; error?: string }>;
  apps: AppRow[];
};

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
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  const running = data.apps.filter((a) => a.status === "running").length;

  return (
    <>
      <PageHeader
        kicker="telemetria"
        title="Painel"
        description="Snapshot de hosts, containers e saúde da frota. Metas fixas: manter uso abaixo de 70%."
        actions={
          <Button asChild variant="outline">
            <Link to="/apps">Ir para aplicações</Link>
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Hosts" value={data.hosts.length} />
        <StatCard label="Apps" value={data.apps.length} />
        <StatCard label="No ar" value={running} tone="success" hint={`${running} de ${data.apps.length} running`} />
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base uppercase tracking-[0.12em] text-muted-foreground">
              Status das aplicações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AppsDonut statuses={data.apps.map((a) => a.status)} />
          </CardContent>
        </Card>
        <HealthLegend />
      </div>

      <div className="space-y-6">
        {data.hosts.map((item) => (
          <Card key={item.host.id}>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-2xl">{item.host.name}</CardTitle>
                <p className="mt-1 font-mono text-sm text-muted-foreground">
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
                  <div className="grid gap-4 md:grid-cols-3">
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
                    <div className="flex flex-col justify-center gap-2 rounded-md border border-border bg-background/40 p-4">
                      <p className="font-sans text-xs uppercase tracking-[0.14em] text-muted-foreground">CPU</p>
                      <p className="font-sans text-3xl font-bold">{item.metrics.cpuCount} núcleos</p>
                      <p className="font-mono text-sm text-muted-foreground">load 1m: {item.metrics.load1}</p>
                      <p className="text-[11px] text-muted-foreground">
                        meta: load próximo ou abaixo do nº de núcleos
                      </p>
                    </div>
                  </div>
                  <div>
                    <h3 className="mb-3 font-sans text-sm uppercase tracking-[0.12em] text-muted-foreground">
                      Containers (CPU / Mem)
                    </h3>
                    <ContainerBarChart containers={item.metrics.containers} />
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
