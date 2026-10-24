import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type HostPoint = {
  name: string;
  mem: number;
  disk: number;
  load: number;
};

export function FleetBars({ hosts }: { hosts: HostPoint[] }) {
  if (hosts.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum host com métricas.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={hosts} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
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
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="mem" name="Mem %" fill="var(--color-chart-1)" />
          <Bar dataKey="disk" name="Disco %" fill="var(--color-chart-5)" />
          <Bar dataKey="load" name="Load / CPU %" fill="var(--color-chart-4)" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
