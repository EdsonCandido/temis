import { useEffect, useState, type ReactNode } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  Box,
  ChevronDown,
  Cpu,
  Folder,
  LayoutDashboard,
  ListTree,
  LogOut,
  Menu,
  Server,
  Shield,
  ShieldOff,
  Filter,
} from "lucide-react";
import { setToken } from "@/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Painel", end: true, icon: LayoutDashboard },
  { to: "/hosts", label: "Hosts", icon: Server },
  { to: "/apps", label: "Aplicações", icon: Box },
];

const systemLinks = [
  { to: "/system/status", label: "Status", icon: Activity },
  { to: "/system/systemd", label: "Systemd", icon: ListTree },
  { to: "/system/proc", label: "Processos", icon: Cpu },
];

const serverLinks = [{ to: "/servers/fail2ban", label: "Fail2Ban", icon: ShieldOff }];

const toolLinks = [{ to: "/tools/files", label: "Arquivos", icon: Folder }];

const networkLinks = [
  { to: "/network/firewall", label: "Firewall", icon: Shield },
  { to: "/network/ipfilter", label: "IPFilter", icon: Filter },
];

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <span
        aria-hidden
        className="flex h-7 w-7 items-center justify-center rounded-control bg-primary text-[13px] font-semibold text-white"
      >
        T
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">Temis</p>
        <p className="truncate text-xs text-muted-foreground">Helios · frota VPS</p>
      </div>
    </div>
  );
}

const itemClass = (isActive: boolean) =>
  cn(
    "flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-sm transition-colors",
    isActive
      ? "bg-sidebar-accent font-medium text-foreground"
      : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground",
  );

function NavGroup({
  title,
  prefix,
  items,
  onNavigate,
}: {
  title: string;
  prefix: string;
  items: { to: string; label: string; icon: typeof Activity }[];
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  const active = pathname.startsWith(prefix);
  const [open, setOpen] = useState(active);

  useEffect(() => {
    if (active) setOpen(true);
  }, [active]);

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-full items-center justify-between rounded-md px-2.5 text-[11px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
      >
        {title}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-0" : "-rotate-90")} />
      </button>
      {open ? (
        <div className="mt-0.5 flex flex-col gap-0.5 border-l border-border/70 ml-3 pl-1">
          {items.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                onClick={onNavigate}
                className={({ isActive }) => itemClass(isActive)}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                {link.label}
              </NavLink>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {links.map((link) => {
        const Icon = link.icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            onClick={onNavigate}
            className={({ isActive }) => itemClass(isActive)}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            {link.label}
          </NavLink>
        );
      })}
      <NavGroup title="Sistema" prefix="/system" items={systemLinks} onNavigate={onNavigate} />
      <NavGroup title="Servidores" prefix="/servers" items={serverLinks} onNavigate={onNavigate} />
      <NavGroup title="Ferramentas" prefix="/tools" items={toolLinks} onNavigate={onNavigate} />
      <NavGroup title="Rede" prefix="/network" items={networkLinks} onNavigate={onNavigate} />
    </nav>
  );
}

function pageTitle(pathname: string) {
  if (pathname.startsWith("/apps/") && pathname !== "/apps") return "Aplicação";
  if (pathname.startsWith("/apps")) return "Aplicações";
  if (pathname.startsWith("/hosts")) return "Hosts";
  if (pathname.startsWith("/system/status")) return "Sistema · Status";
  if (pathname.startsWith("/system/systemd")) return "Sistema · Systemd";
  if (pathname.startsWith("/system/proc")) return "Sistema · Processos";
  if (pathname.startsWith("/servers/fail2ban")) return "Servidores · Fail2Ban";
  if (pathname.startsWith("/tools/files")) return "Ferramentas · Arquivos";
  if (pathname.startsWith("/network/firewall")) return "Rede · Firewall";
  if (pathname.startsWith("/network/ipfilter")) return "Rede · IPFilter";
  return "Painel";
}

export function AppShell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  function logout() {
    setToken(null);
    nav("/login");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="lg:grid lg:min-h-screen lg:grid-cols-[228px_minmax(0,1fr)]">
        <aside className="hidden flex-col bg-sidebar px-3 py-4 text-sidebar-foreground lg:flex">
          <BrandMark />
          <div className="mt-6 px-0.5">
            <NavItems />
          </div>
          <div className="mt-auto px-1 pt-8">
            <p className="mb-2 text-xs text-muted-foreground">Conta</p>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button variant="outline" className="h-8 flex-1 text-xs" onClick={logout}>
                <LogOut className="h-3.5 w-3.5" />
                Sair
              </Button>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between gap-3 bg-background px-3 lg:pr-4">
            <div className="flex min-w-0 items-center gap-2">
              <Sheet open={open} onOpenChange={setOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Abrir menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent className="bg-background">
                  <SheetHeader>
                    <SheetTitle>Temis</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6">
                    <BrandMark />
                    <div className="mt-6">
                      <NavItems onNavigate={() => setOpen(false)} />
                    </div>
                    <div className="mt-8 flex items-center gap-2">
                      <ThemeToggle />
                      <Button variant="outline" className="flex-1" onClick={logout}>
                        Sair
                      </Button>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
              <p className="truncate text-sm text-muted-foreground lg:text-foreground">{pageTitle(pathname)}</p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle className="lg:hidden" />
              <Button variant="ghost" size="sm" className="lg:hidden" onClick={logout}>
                Sair
              </Button>
            </div>
          </header>

          <div className="flex-1 px-0 pb-2 pr-0 lg:pr-2 lg:pb-2">
            <main className="min-h-[calc(100vh-3.5rem)] rounded-none border-0 bg-card px-4 py-6 sm:px-6 lg:min-h-[calc(100vh-3.5rem)] lg:rounded-xl lg:border lg:border-border lg:px-8 lg:py-7">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}
