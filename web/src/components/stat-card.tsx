import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <div className="min-w-0 px-5 py-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "num mt-1 text-[28px] font-normal leading-none text-foreground",
          tone === "success" && "text-chart-2",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function KpiStrip({ children }: { children: ReactNode }) {
  return (
    <div className="mb-6 grid overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-2 lg:grid-cols-4 [&>*]:border-b [&>*]:border-border sm:[&>*:nth-child(odd)]:border-r lg:[&>*]:border-b-0 lg:[&>*:not(:last-child)]:border-r lg:[&>*:nth-child(odd)]:border-r">
      {children}
    </div>
  );
}
