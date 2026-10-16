import type { ReactNode } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { token, setToken } from "./api";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Hosts } from "./pages/Hosts";
import { Apps } from "./pages/Apps";
import { AppDetail } from "./pages/AppDetail";

function Guard({ children }: { children: ReactNode }) {
  if (!token()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Layout({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="shell">
      <aside>
        <p className="kicker">Helios</p>
        <h1 className="brand">TEMIS</h1>
        <p>controle de máquinas, imagens e proxy.</p>
        <nav>
          <NavLink to="/" end>
            Painel
          </NavLink>
          <NavLink to="/hosts">Hosts</NavLink>
          <NavLink to="/apps">Aplicações</NavLink>
        </nav>
        <p>
          <button
            className="ghost"
            onClick={() => {
              setToken(null);
              nav("/login");
            }}
          >
            Sair
          </button>
        </p>
      </aside>
      <main>{children}</main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <Guard>
            <Layout>
              <Overview />
            </Layout>
          </Guard>
        }
      />
      <Route
        path="/hosts"
        element={
          <Guard>
            <Layout>
              <Hosts />
            </Layout>
          </Guard>
        }
      />
      <Route
        path="/apps"
        element={
          <Guard>
            <Layout>
              <Apps />
            </Layout>
          </Guard>
        }
      />
      <Route
        path="/apps/:id"
        element={
          <Guard>
            <Layout>
              <AppDetail />
            </Layout>
          </Guard>
        }
      />
    </Routes>
  );
}
