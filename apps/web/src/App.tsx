import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { token } from "@/api";
import { AppShell } from "@/components/app-shell";
import { Login } from "@/pages/Login";
import { Overview } from "@/pages/Overview";
import { Hosts } from "@/pages/Hosts";
import { Apps } from "@/pages/Apps";
import { AppDetail } from "@/pages/AppDetail";

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
    </Routes>
  );
}
