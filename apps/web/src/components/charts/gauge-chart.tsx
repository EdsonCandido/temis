import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
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
  const data = [
    { name: "used", value: clamped },
    { name: "free", value: 100 - clamped },
  ];

  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-border bg-background/40 p-4">
      <p className="font-sans text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              startAngle={180}
              endAngle={0}
              innerRadius="68%"
              outerRadius="100%"
              stroke="none"
              cy="75%"
            >
              <Cell fill={healthColor(level)} />
              <Cell fill="var(--color-border)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="-mt-8 text-center">
        <div className="font-sans text-3xl font-bold" style={{ color: healthColor(level) }}>
          {clamped.toFixed(1)}%
        </div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{healthLabel(level)}</p>
        {detail ? <p className="mt-1 font-mono text-xs text-muted-foreground">{detail}</p> : null}
        <p className="mt-2 text-[11px] text-muted-foreground">{HEALTH_META}</p>
      </div>
    </div>
  );
}
