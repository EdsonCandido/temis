import { HEALTH_META, healthColor, healthLabel, healthLevel } from "@/lib/utils";

export function GaugeChart({
  label,
  percent,
  detail,
}: {
  label: string;
  percent: number;
  detail?: string;
}) {
  const level = healthLevel(percent);
  const clamped = Math.max(0, Math.min(100, percent));

  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="num text-sm text-foreground" style={{ color: healthColor(level) }}>
          {clamped.toFixed(1)}%
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full"
          style={{ width: `${clamped}%`, background: healthColor(level) }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{detail ?? healthLabel(level)}</span>
        <span>{HEALTH_META}</span>
      </div>
    </div>
  );
}
