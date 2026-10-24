import { HEALTH_META } from "@/lib/utils";

export function HealthLegend() {
  return (
    <div className="text-sm leading-[1.45]">
      <p className="text-sm text-muted-foreground">{HEALTH_META}</p>
      <ul className="mt-3 space-y-2">
        <li className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-chart-2" />
            ok
          </span>
          <span className="num text-foreground">&lt; 70%</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-chart-3" />
            atenção
          </span>
          <span className="num text-foreground">70–85%</span>
        </li>
        <li className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-destructive" />
            crítico
          </span>
          <span className="num text-foreground">&gt; 85%</span>
        </li>
      </ul>
    </div>
  );
}
