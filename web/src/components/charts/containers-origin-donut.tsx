import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = {
  known: "var(--color-chart-1)",
  unknown: "var(--color-chart-5)",
};

export function ContainersOriginDonut({ known, unknown }: { known: number; unknown: number }) {
  const data = [
    { name: "Têmis", value: known, key: "known" as const },
    { name: "não conhecidos", value: unknown, key: "unknown" as const },
  ].filter((row) => row.value > 0);
  const total = known + unknown;

  if (total === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-2.5 text-sm text-muted-foreground">
        Nenhum container no Docker deste painel.
      </p>
    );
  }

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[140px_1fr]">
      <div className="h-36 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="68%" outerRadius="88%" paddingAngle={2} stroke="none">
              {data.map((entry) => (
                <Cell key={entry.key} fill={COLORS[entry.key]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderRadius: 6,
                color: "var(--color-foreground)",
                fontSize: 12,
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2">
        {data.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS[row.key] }} />
              {row.name}
            </span>
            <span className="num text-foreground">
              {row.value}
              <span className="ml-1 text-muted-foreground">
                / {total} ({Math.round((row.value / total) * 100)}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
