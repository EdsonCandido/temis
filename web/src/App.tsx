import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { token } from "@/api";
import { AppShell } from "@/components/app-shell";
import { Login } from "@/pages/Login";
import { Overview } from "@/pages/Overview";
import { Hosts } from "@/pages/Hosts";
import { Apps } from "@/pages/Apps";
import { AppDetail } from "@/pages/AppDetail";
import { StatusPage } from "@/pages/system/StatusPage";
import { SystemdPage } from "@/pages/system/SystemdPage";
import { ProcPage } from "@/pages/system/ProcPage";
import { Fail2banPage } from "@/pages/servers/Fail2banPage";
import { FilesPage } from "@/pages/tools/FilesPage";
import { FirewallPage } from "@/pages/network/FirewallPage";
import { IpfilterPage } from "@/pages/network/IpfilterPage";

function Guard({ children }: { children: ReactNode }) {
  if (!token()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Protected({ children }: { children: ReactNode }) {
  return (
    <Guard>
      <AppShell>{children}</AppShell>
    </Guard>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Protected>
            <Overview />
          </Protected>
        }
      />
      <Route
        path="/hosts"
        element={
          <Protected>
            <Hosts />
          </Protected>
        }
      />
      <Route
        path="/apps"
        element={
          <Protected>
            <Apps />
          </Protected>
        }
      />
      <Route
        path="/apps/:id"
        element={
          <Protected>
            <AppDetail />
          </Protected>
        }
      />
      <Route
        path="/system/status"
        element={
          <Protected>
            <StatusPage />
          </Protected>
        }
      />
      <Route
        path="/system/systemd"
        element={
          <Protected>
            <SystemdPage />
          </Protected>
        }
      />
      <Route
        path="/system/proc"
        element={
          <Protected>
            <ProcPage />
          </Protected>
        }
      />
      <Route
        path="/servers/fail2ban"
        element={
          <Protected>
            <Fail2banPage />
          </Protected>
        }
      />
      <Route
        path="/tools/files"
        element={
          <Protected>
            <FilesPage />
          </Protected>
        }
      />
      <Route
        path="/network/firewall"
        element={
          <Protected>
            <FirewallPage />
          </Protected>
        }
      />
      <Route
        path="/network/ipfilter"
        element={
          <Protected>
            <IpfilterPage />
          </Protected>
        }
      />
    </Routes>
  );
}
