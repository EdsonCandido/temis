import { useState, type ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Menu, Server } from "lucide-react";
import { setToken } from "@/api";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const links = [
  { to: "/", label: "Painel", end: true },
  { to: "/hosts", label: "Hosts" },
  { to: "/apps", label: "Aplicações" },
];

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "rounded-md border border-transparent px-3 py-2 font-sans text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )
          }
        >
          {link.label}
        </NavLink>
      ))}
    </nav>
  );
}

function BrandBlock() {
  return (
    <div className="mb-8">
      <p className="font-sans text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Helios</p>
      <h1 className="font-sans text-3xl font-bold tracking-[0.08em]">TEMIS</h1>
      <p className="mt-2 text-sm text-muted-foreground">controle de máquinas, imagens e proxy.</p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  function logout() {
    setToken(null);
    nav("/login");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-sidebar-border bg-sidebar p-6 text-sidebar-foreground lg:flex lg:flex-col">
        <BrandBlock />
        <NavItems />
        <div className="mt-auto space-y-4 pt-8">
          <Separator className="bg-sidebar-border" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" className="flex-1" onClick={logout}>
              Sair
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2 font-sans font-semibold tracking-wide">
            <Server className="h-4 w-4 text-muted-foreground" />
            TEMIS
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Abrir menu">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent className="border-sidebar-border bg-sidebar text-sidebar-foreground">
                <SheetHeader>
                  <SheetTitle>Navegação</SheetTitle>
                </SheetHeader>
                <div className="mt-6">
                  <BrandBlock />
                  <NavItems onNavigate={() => setOpen(false)} />
                  <div className="mt-8 flex items-center gap-2">
                    <ThemeToggle />
                    <Button variant="outline" className="flex-1" onClick={logout}>
                      Sair
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </header>
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
