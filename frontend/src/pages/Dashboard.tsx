import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon";
import { api, getStoredUser } from "../lib/api";

function Dashboard() {
  const user = getStoredUser();
  const [counts, setCounts] = useState({ total: 0, active: 0 });

  useEffect(() => {
    api.scouts.list()
      .then(({ scouts }) => {
        setCounts({
          total: scouts.length,
          active: scouts.filter((scout) => scout.status === "Active").length,
        });
      })
      .catch(() => setCounts({ total: 0, active: 0 }));
  }, []);

  const metrics = [
    {
      label: "Visible scouts",
      value: String(counts.total),
      detail: counts.total === 0 ? "No records yet" : `${counts.active} active`,
      icon: "users" as const,
      tone: "green",
    },
    {
      label: "Upcoming events",
      value: "0",
      detail: "No events scheduled",
      icon: "calendar" as const,
      tone: "gold",
    },
    {
      label: "Attendance rate",
      value: "—",
      detail: "No attendance recorded",
      icon: "attendance" as const,
      tone: "blue",
    },
  ];

  return (
    <div className="page">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">ScoutOS workspace</span>
          <h1>Welcome, {user?.fullName || user?.username || "there"}.</h1>
          <p>Your dashboard only displays information your role is permitted to access.</p>
        </div>
        <Link className="button button-light" to="/scouts">
          <Icon name="plus" size={18} />
          Add a scout
        </Link>
      </section>

      <section className="metrics-grid">
        {metrics.map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span className={`metric-icon ${metric.tone}`}>
              <Icon name={metric.icon} size={23} />
            </span>
            <div>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
              <small>{metric.detail}</small>
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel dashboard-empty-panel">
          <span className="coming-soon-icon"><Icon name="events" size={27} /></span>
          <span className="eyebrow">Upcoming events</span>
          <h2>No events scheduled</h2>
          <p>Events you create will appear here with their real date, time, and location.</p>
          <Link className="button button-secondary" to="/events">Go to events</Link>
        </article>

        <article className="panel dashboard-empty-panel">
          <span className="coming-soon-icon"><Icon name="attendance" size={27} /></span>
          <span className="eyebrow">Attendance</span>
          <h2>No records yet</h2>
          <p>Attendance summaries will appear after you record your first meeting.</p>
          <Link className="button button-secondary" to="/attendance">Go to attendance</Link>
        </article>
      </section>
    </div>
  );
}

export default Dashboard;
