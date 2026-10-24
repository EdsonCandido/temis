import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "running" ? "success" : status === "error" ? "danger" : status === "stopped" ? "warning" : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}
