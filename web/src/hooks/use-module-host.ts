import { useEffect, useState } from "react";
import { api, type Host } from "@/api";

const KEY = "temis_module_host";

export function useModuleHost() {
  const [hosts, setHosts] = useState<Host[]>([]);
  const [hostId, setHostIdState] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<Host[]>("/api/hosts")
      .then((list) => {
        setHosts(list);
        const saved = Number(sessionStorage.getItem(KEY) || 0);
        const next = list.find((h) => h.id === saved)?.id ?? list[0]?.id ?? null;
        setHostIdState(next);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "falha ao listar hosts"));
  }, []);

  function setHostId(id: number) {
    setHostIdState(id);
    sessionStorage.setItem(KEY, String(id));
  }

  return { hosts, hostId, setHostId, error };
}
