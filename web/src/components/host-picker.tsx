import type { Host } from "@/api";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";

export function HostPicker({
  hosts,
  hostId,
  onChange,
}: {
  hosts: Host[];
  hostId: number | null;
  onChange: (id: number) => void;
}) {
  return (
    <div className="grid w-full min-w-0 gap-1.5 sm:max-w-xs">
      <Label htmlFor="module-host">Host</Label>
      <SelectNative
        id="module-host"
        className="w-full"
        value={hostId ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={hosts.length === 0}
      >
        {hosts.length === 0 ? <option value="">Nenhum host</option> : null}
        {hosts.map((h) => (
          <option key={h.id} value={h.id}>
            {h.name} ({h.kind})
          </option>
        ))}
      </SelectNative>
    </div>
  );
}
