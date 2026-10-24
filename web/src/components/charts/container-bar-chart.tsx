import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ContainerStat = {
  name: string;
  cpu: string;
  memPercent: string;
  known?: boolean;
};

function parsePercent(value: string): number {
  const n = Number.parseFloat(String(value).replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function ContainerBarChart({ containers }: { containers: ContainerStat[] }) {
  const data = containers.map((c) => ({
    name: c.name.length > 18 ? `${c.name.slice(0, 16)}…` : c.name,
    fullName: c.name,
    cpu: parsePercent(c.cpu),
    mem: parsePercent(c.memPercent),
    known: Boolean(c.known),
  }));

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum container neste host.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} />
          <YAxis tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }} unit="%" />
          <Tooltip
            contentStyle={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 6,
              color: "var(--color-foreground)",
            }}
            formatter={(value, key, item) => {
              const known = Boolean(item?.payload?.known);
              const series = key === "cpu" ? "CPU %" : "Mem %";
              return [`${value}% · ${known ? "Têmis" : "não conhecida"}`, series];
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="cpu" name="CPU %" radius={[0, 0, 0, 0]}>
            {data.map((row) => (
              <Cell
                key={`cpu-${row.fullName}`}
                fill={row.known ? "var(--color-chart-1)" : "var(--color-chart-5)"}
              />
            ))}
          </Bar>
          <Bar dataKey="mem" name="Mem %" radius={[0, 0, 0, 0]}>
            {data.map((row) => (
              <Cell
                key={`mem-${row.fullName}`}
                fill={row.known ? "var(--color-chart-4)" : "var(--color-chart-3)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
