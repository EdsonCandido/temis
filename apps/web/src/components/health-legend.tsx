import { HEALTH_META } from "@/lib/utils";

export function HealthLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-card/80 px-4 py-3 text-sm">
      <span className="font-sans text-xs uppercase tracking-[0.14em] text-muted-foreground">{HEALTH_META}</span>
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-chart-2" />
        ok &lt; 70%
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-chart-3" />
        atenção 70–85%
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
        crítico &gt; 85%
      </span>
    </div>
  );
}
