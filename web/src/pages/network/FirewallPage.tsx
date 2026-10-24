import { useCallback, useEffect, useState } from "react";
import { api } from "@/api";
import { toast } from "@/lib/toast";
import { HostPicker } from "@/components/host-picker";
import { PageHeader } from "@/components/page-header";
import { useModuleHost } from "@/hooks/use-module-host";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectNative } from "@/components/ui/select-native";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

type Rule = {
  num: number;
  pkts: string;
  bytes: string;
  target: string;
  proto: string;
  source: string;
  destination: string;
  extra: string;
};

type Chain = {
  name: string;
  policy: string;
  rules: Rule[];
};

type Finding = {
  id: string;
  level: "ok" | "ask" | "risk";
  chain: string;
  num: number | null;
  port: number | null;
  pkts: string;
  bytes: string;
  question: string;
};

type BasicsStatus = {
  lo: boolean;
  established: boolean;
  ssh: boolean;
  http: boolean;
  https: boolean;
  invalid: boolean;
  sshPort: number;
};

type Listener = {
  proto: string;
  bind: string;
  port: number;
  publicBind: boolean;
};

type Payload = {
  available: boolean;
  chains: Chain[];
  basics: BasicsStatus;
  findings: Finding[];
  traffic: { tcpEstab: number; timeWait: number; listeners: Listener[] };
  message: string | null;
};

const CHAINS = ["INPUT", "FORWARD", "OUTPUT"] as const;
const PROTOS = ["tcp", "udp", "icmp", "all"] as const;
const TARGETS = ["ACCEPT", "DROP", "REJECT"] as const;

const BASIC_OPTIONS = [
  { id: "lo", label: "Loopback (lo)" },
  { id: "established", label: "RELATED,ESTABLISHED" },
  { id: "invalid", label: "DROP INVALID" },
  { id: "ssh", label: "SSH" },
  { id: "http", label: "HTTP 80" },
  { id: "https", label: "HTTPS 443" },
] as const;

type BasicId = (typeof BASIC_OPTIONS)[number]["id"];

function formatCount(raw: string) {
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function FirewallPage() {
  const { hosts, hostId, setHostId, error: hostError } = useModuleHost();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [chain, setChain] = useState<(typeof CHAINS)[number]>("INPUT");
  const [proto, setProto] = useState<(typeof PROTOS)[number]>("tcp");
  const [target, setTarget] = useState<(typeof TARGETS)[number]>("ACCEPT");
  const [port, setPort] = useState("");
  const [source, setSource] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pendingDelete, setPendingDelete] = useState<{ chain: string; num: number } | null>(null);
  const [pendingBasics, setPendingBasics] = useState(false);
  const [sshPort, setSshPort] = useState("22");
  const [basicIds, setBasicIds] = useState<BasicId[]>(["lo", "established", "invalid", "ssh"]);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!hostId) return;
    setError("");
    try {
      setData(await api<Payload>(`/api/modules/firewall?hostId=${hostId}`));
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : "falha ao listar iptables");
    }
  }, [hostId]);

  useEffect(() => {
    load().catch(() => undefined);
  }, [load]);

  async function exportRules() {
    if (!hostId) return;
    setExporting(true);
    setError("");
    try {
      const file = await api<{ filename: string; content: string }>(`/api/modules/firewall/export?hostId=${hostId}`);
      const blob = new Blob([file.content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exportado ${file.filename}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "falha ao exportar regras");
    } finally {
      setExporting(false);
    }
  }

  function toggleBasic(id: BasicId) {
    setBasicIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function addRule() {
    if (!hostId) return;
    if (target === "ACCEPT" && motivo.trim().length < 8) {
      setError("Para ACCEPT, escreva o motivo da porta/origem estar aberta (mínimo 8 caracteres).");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const body: Record<string, unknown> = { hostId, chain, proto, target, motivo: motivo.trim() };
      if (port.trim()) body.port = Number(port);
      if (source.trim()) body.source = source.trim();
      await api("/api/modules/firewall/add", { method: "POST", body: JSON.stringify(body) });
      toast.success("Regra acrescentada na chain.");
      setPort("");
      setSource("");
      setMotivo("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "falha ao acrescentar regra");
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    if (!hostId || !pendingDelete) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/modules/firewall/delete", {
        method: "POST",
        body: JSON.stringify({ hostId, chain: pendingDelete.chain, num: pendingDelete.num }),
      });
      toast.success(`Regra ${pendingDelete.num} removida de ${pendingDelete.chain}.`);
      setPendingDelete(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "falha ao remover regra");
    } finally {
      setBusy(false);
    }
  }

  async function confirmBasics() {
    if (!hostId) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<{ applied: string[]; skipped: string[] }>("/api/modules/firewall/basics", {
        method: "POST",
        body: JSON.stringify({ hostId, ids: basicIds, sshPort: Number(sshPort) || 22 }),
      });
      toast.success(`Kit: ${r.applied.length} aplicada(s), ${r.skipped.length} já existia(m).`);
      setPendingBasics(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "falha ao aplicar kit básico");
    } finally {
      setBusy(false);
    }
  }

  const findings = (data?.findings ?? []).filter((f) => f.level !== "ok");
  const risk = findings.filter((f) => f.level === "risk").length;

  return (
    <>
      <PageHeader
        title="Firewall (iptables)"
        description="Tabela filter, kit básico, auditoria do que está aberto e tráfego por regra e porta."
        actions={
          <>
            <HostPicker hosts={hosts} hostId={hostId} onChange={setHostId} />
            <Button className="w-full sm:w-auto" variant="outline" onClick={load} disabled={!hostId}>
              Atualizar
            </Button>
            <Button
              className="w-full sm:w-auto"
              variant="outline"
              onClick={() => exportRules().catch(() => undefined)}
              disabled={!hostId || exporting}
            >
              {exporting ? "Exportando…" : "Exportar regras"}
            </Button>
          </>
        }
      />

      <Alert className="mb-6">
        <AlertDescription>
          DROP ou exclusão da regra de SSH pode cortar o acesso ao host. O kit básico só insere regras que ainda
          não existem; não faz flush e não grava persistência.
        </AlertDescription>
      </Alert>

      {hostError || error ? (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{hostError || error}</AlertDescription>
        </Alert>
      ) : null}

      {!hostId && !hostError ? (
        <p className="text-sm text-muted-foreground">Cadastre um host em Hosts para usar este módulo.</p>
      ) : null}

      {data && !data.available ? (
        <Alert className="mb-6">
          <AlertDescription>{data.message ?? "iptables não existe neste host."}</AlertDescription>
        </Alert>
      ) : null}

      {data?.available ? (
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-1 text-base font-semibold">Kit básico de segurança</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Insere na INPUT o mínimo usual: loopback, estado de conexão, SSH e, se marcar, HTTP/HTTPS.
              </p>
              <fieldset className="grid gap-3 max-w-full sm:grid-cols-2 lg:grid-cols-3">
                <legend className="sr-only">Regras do kit</legend>
                {BASIC_OPTIONS.map((opt) => {
                  const present = data.basics[opt.id];
                  return (
                    <label key={opt.id} className="flex min-h-10 min-w-0 items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-primary"
                        checked={basicIds.includes(opt.id)}
                        onChange={() => toggleBasic(opt.id)}
                      />
                      <span>{opt.label}</span>
                      {present ? (
                        <Badge variant="success">já tem</Badge>
                      ) : (
                        <Badge variant="warning">falta</Badge>
                      )}
                    </label>
                  );
                })}
              </fieldset>
              <div className="mt-4 grid w-full min-w-0 gap-3 sm:flex sm:max-w-xl sm:items-end">
                <div className="grid w-full min-w-0 gap-1.5 sm:max-w-xs">
                  <Label htmlFor="fw-ssh-port">Porta SSH</Label>
                  <Input
                    id="fw-ssh-port"
                    inputMode="numeric"
                    value={sshPort}
                    onChange={(e) => setSshPort(e.target.value)}
                  />
                </div>
                <Button
                  className="w-full sm:w-auto"
                  disabled={busy || basicIds.length === 0}
                  onClick={() => setPendingBasics(true)}
                >
                  Aplicar kit básico
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="text-base font-semibold">Por que está aberto?</h2>
                <Badge variant={risk > 0 ? "danger" : findings.length ? "warning" : "success"}>
                  {findings.length} ponto{findings.length === 1 ? "" : "s"}
                </Badge>
              </div>
              {findings.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum ACCEPT amplo sem motivo óbvio (loopback e ESTABLISHED ficam de fora).
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nível</TableHead>
                      <TableHead>Chain</TableHead>
                      <TableHead>Porta</TableHead>
                      <TableHead className="text-right">Pkts</TableHead>
                      <TableHead>Pergunta</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {findings.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          <Badge variant={f.level === "risk" ? "danger" : "warning"}>
                            {f.level === "risk" ? "risco" : "questionar"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{f.chain}</TableCell>
                        <TableCell className="tabular-nums">{f.port ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCount(f.pkts)}
                        </TableCell>
                        <TableCell className="max-w-[52ch] text-sm">{f.question}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-1 text-base font-semibold">Tráfego</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                {data.traffic.tcpEstab} TCP estabelecidos
                {" · "}
                {data.traffic.timeWait} TIME_WAIT
                {" · "}
                {data.traffic.listeners.length} portas em escuta
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proto</TableHead>
                    <TableHead>Bind</TableHead>
                    <TableHead className="text-right">Porta</TableHead>
                    <TableHead>Exposição</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.traffic.listeners.map((l, i) => (
                    <TableRow key={`${l.proto}-${l.bind}-${l.port}-${i}`}>
                      <TableCell className="text-muted-foreground">{l.proto}</TableCell>
                      <TableCell className="font-mono text-xs">{l.bind}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.port}</TableCell>
                      <TableCell>
                        <Badge variant={l.publicBind ? "warning" : "secondary"}>
                          {l.publicBind ? "público" : "local"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {data.traffic.listeners.length === 0 ? (
                <p className="mt-4 text-sm text-muted-foreground">ss/netstat não devolveu escuta neste host.</p>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <h2 className="mb-4 text-base font-semibold">Acrescentar regra</h2>
              <form
                className="grid w-full min-w-0 max-w gap-4 md:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  addRule().catch(() => undefined);
                }}
              >
                <div className="grid gap-1.5">
                  <Label htmlFor="fw-chain">Chain</Label>
                  <SelectNative id="fw-chain" value={chain} onChange={(e) => setChain(e.target.value as typeof chain)}>
                    {CHAINS.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </SelectNative>
                  <p className="text-xs text-muted-foreground md:min-h-8">INPUT, FORWARD ou OUTPUT.</p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="fw-proto">Protocolo</Label>
                  <SelectNative id="fw-proto" value={proto} onChange={(e) => setProto(e.target.value as typeof proto)}>
                    {PROTOS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </SelectNative>
                  <p className="text-xs text-muted-foreground md:min-h-8">tcp, udp, icmp ou all.</p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="fw-port">Porta destino</Label>
                  <Input
                    id="fw-port"
                    inputMode="numeric"
                    placeholder="22"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                    aria-describedby="fw-port-hint"
                  />
                  <p id="fw-port-hint" className="text-xs text-muted-foreground md:min-h-8">
                    Opcional; só tcp/udp.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="fw-source">Origem</Label>
                  <Input
                    id="fw-source"
                    placeholder="0.0.0.0/0"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    aria-describedby="fw-source-hint"
                  />
                  <p id="fw-source-hint" className="text-xs text-muted-foreground md:min-h-8">
                    IPv4 ou CIDR, opcional.
                  </p>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="fw-target">Alvo</Label>
                  <SelectNative id="fw-target" value={target} onChange={(e) => setTarget(e.target.value as typeof target)}>
                    {TARGETS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </SelectNative>
                  <p className="text-xs text-muted-foreground md:min-h-8">ACCEPT exige motivo abaixo.</p>
                </div>
                {target === "ACCEPT" ? (
                  <div className="grid gap-1.5 md:col-span-2">
                    <Label htmlFor="fw-motivo">Motivo de abrir</Label>
                    <Textarea
                      id="fw-motivo"
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      placeholder="Ex.: site público na 443; SSH só enquanto instalo o painel"
                      aria-describedby="fw-motivo-hint"
                    />
                    <p id="fw-motivo-hint" className="text-xs text-muted-foreground">
                      Obrigatório em ACCEPT. Explique por que a origem pode chegar nessa porta.
                    </p>
                  </div>
                ) : null}
                <div className="md:col-span-2">
                  <Button type="submit" className="w-full sm:w-auto" disabled={busy}>
                    {busy ? "Aplicando…" : "Acrescentar"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {data.chains.map((c) => (
            <Card key={c.name}>
              <CardContent className="pt-6">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-semibold">{c.name}</h2>
                  <Badge variant="secondary">policy {c.policy}</Badge>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">Nº</TableHead>
                      <TableHead>Alvo</TableHead>
                      <TableHead>Proto</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Destino</TableHead>
                      <TableHead className="text-right">Pkts</TableHead>
                      <TableHead className="text-right">Bytes</TableHead>
                      <TableHead>Extra</TableHead>
                      <TableHead className="text-right">Ação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {c.rules.map((r) => (
                      <TableRow key={`${c.name}-${r.num}`}>
                        <TableCell className="text-right font-mono text-xs tabular-nums">{r.num}</TableCell>
                        <TableCell>
                          <Badge variant={r.target === "DROP" || r.target === "REJECT" ? "danger" : "success"}>
                            {r.target}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{r.proto}</TableCell>
                        <TableCell className="font-mono text-xs">{r.source}</TableCell>
                        <TableCell className="font-mono text-xs">{r.destination}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {formatCount(r.pkts)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{r.bytes}</TableCell>
                        <TableCell className="max-w-[20ch] truncate text-muted-foreground">{r.extra}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="destructive"
                            size="sm"
                            disabled={busy}
                            onClick={() => setPendingDelete({ chain: c.name, num: r.num })}
                          >
                            Apagar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {c.rules.length === 0 ? (
                  <p className="mt-4 text-sm text-muted-foreground">Nenhuma regra nesta chain.</p>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}

      <Dialog open={pendingBasics} onOpenChange={(open) => !open && setPendingBasics(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar kit básico?</DialogTitle>
            <DialogDescription>
              Insere na INPUT: {basicIds.join(", ")}. Porta SSH {sshPort}. Não altera policy, não apaga regra
              existente. Se o host já usa UFW, essas linhas ficam acima das chains do UFW.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingBasics(false)}>
              Cancelar
            </Button>
            <Button disabled={busy} onClick={() => confirmBasics().catch(() => undefined)}>
              {busy ? "Aplicando…" : "Aplicar kit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apagar regra {pendingDelete?.num}?</DialogTitle>
            <DialogDescription>
              Remove a linha {pendingDelete?.num} da chain {pendingDelete?.chain}. Se essa regra libera SSH, o
              host pode ficar inacessível.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => confirmDelete().catch(() => undefined)}>
              {busy ? "Apagando…" : "Apagar regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
