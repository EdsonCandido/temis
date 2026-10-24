import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  kicker?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-4">
      <div className="max-w-[65ch] space-y-1.5">
        <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
        {description ? <p className="text-sm leading-[1.45] text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? (
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">{actions}</div>
      ) : null}
    </div>
  );
}
