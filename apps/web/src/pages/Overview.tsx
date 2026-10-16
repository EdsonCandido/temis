import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type AppRow, type Host, type Metrics } from "../api";

type OverviewData = {
  hosts: Array<{ host: Host; metrics?: Metrics; error?: string }>;
  apps: AppRow[];
};

export function Overview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<OverviewData>("/api/overview")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="bad">{error}</p>;
  if (!data) return <p>lendo sensores…</p>;

  return (
    <>
      <p className="kicker">telemetria</p>
      <h1>Painel</h1>
      <div className="grid cards">
        <div className="card">
          <h3>Hosts</h3>
          <div className="big">{data.hosts.length}</div>
        </div>
        <div className="card">
          <h3>Apps</h3>
          <div className="big">{data.apps.length}</div>
        </div>
        <div className="card">
          <h3>No ar</h3>
          <div className="big ok">{data.apps.filter((a) => a.status === "running").length}</div>
        </div>
      </div>
      {data.hosts.map((item) => (
        <section key={item.host.id} className="card" style={{ marginTop: 16 }}>
          <h2>
            {item.host.name} <span className="mono">({item.host.kind})</span>
          </h2>
          {item.error && <p className="bad">{item.error}</p>}
          {item.metrics && (
            <>
              <div className="grid cards">
                <div>
                  <h3>CPU</h3>
                  <div className="big">{item.metrics.cpuCount} núcleos</div>
                  <p>load {item.metrics.load1}</p>
                </div>
                <div>
                  <h3>Memória</h3>
                  <div className="big">{item.metrics.memPercent}%</div>
                  <p>
                    {item.metrics.memUsedMb} / {item.metrics.memTotalMb} MB
                  </p>
                </div>
                <div>
                  <h3>Disco</h3>
                  <div className="big">{item.metrics.diskPercent}%</div>
                  <p>
                    {item.metrics.diskUsedGb} / {item.metrics.diskTotalGb} GB
                  </p>
                </div>
                <div>
                  <h3>Docker</h3>
                  <div className={`big ${item.metrics.dockerOk ? "ok" : "bad"}`}>
                    {item.metrics.dockerOk ? "ok" : "off"}
                  </div>
                </div>
              </div>
              {item.metrics.containers.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>container</th>
                      <th>cpu</th>
                      <th>mem</th>
                      <th>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.metrics.containers.map((c) => (
                      <tr key={c.name}>
                        <td className="mono">{c.name}</td>
                        <td>{c.cpu}</td>
                        <td>{c.mem}</td>
                        <td>{c.memPercent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </section>
      ))}
      <p>
        <Link to="/apps">ir para aplicações</Link>
      </p>
    </>
  );
}
