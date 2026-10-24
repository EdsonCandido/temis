import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS: Record<string, string> = {
  running: "var(--color-chart-1)",
  exited: "var(--color-chart-5)",
  paused: "var(--color-chart-3)",
  restarting: "var(--color-chart-4)",
  other: "var(--color-border)",
};

const LABELS: Record<string, string> = {
  running: "no ar",
  exited: "parado",
  paused: "pausado",
  restarting: "reiniciando",
  other: "outro",
};

export function normalizeDockerState(status: string): keyof typeof COLORS {
  const value = status.toLowerCase();
  if (/restarting/.test(value)) return "restarting";
  if (/paused/.test(value)) return "paused";
  if (/running|^up\b/.test(value)) return "running";
  if (/exited|stopped|dead|created/.test(value)) return "exited";
  return "other";
}

export function ContainersStateDonut({ statuses }: { statuses: string[] }) {
  const counts = statuses.reduce<Record<string, number>>((acc, status) => {
    const key = normalizeDockerState(status);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const data = Object.entries(counts).map(([key, value]) => ({
    key,
    name: LABELS[key] ?? key,
    value,
  }));
  const total = data.reduce((sum, row) => sum + row.value, 0);

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
                <Cell key={entry.key} fill={COLORS[entry.key] ?? COLORS.other} />
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
              <span className="h-2 w-2 rounded-full" style={{ background: COLORS[row.key] ?? COLORS.other }} />
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
