import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import DashboardGalleryPreview from "../components/gallery/DashboardGalleryPreview";
import Icon from "../components/Icon";
import {
  api,
  getStoredUser,
  type AttendanceSession,
  type AuthUser,
  type FinanceSummary,
  type GallerySummary,
  type PointsTransaction,
  type Scout,
  type ScoutAttendanceProfileSummary,
  type ScoutEvent,
} from "../lib/api";

function today() {
  const date = new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-JO", {
    style: "currency",
    currency: "JOD",
    minimumFractionDigits: 2,
  }).format(value);
}

function Dashboard() {
  const user = getStoredUser();
  const role = user?.role;
  const scoutId = user?.scoutId || null;
  const isScout = role === "SCOUT";
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [events, setEvents] = useState<ScoutEvent[]>([]);
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);
  const [accounts, setAccounts] = useState<AuthUser[]>([]);
  const [gallery, setGallery] = useState<GallerySummary | null>(null);
  const [galleryError, setGalleryError] = useState(false);
  const [scoutAttendance, setScoutAttendance] = useState<ScoutAttendanceProfileSummary | null>(null);
  const [pointHistory, setPointHistory] = useState<PointsTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      if (isScout) {
        if (!scoutId) {
          setError("This Scout account is not linked to a Scout record.");
          return;
        }
        const results = await Promise.allSettled([
          api.events.list(),
          api.points.history(scoutId),
          api.attendance.scoutSummary(scoutId),
          api.gallery.summary(4),
        ] as const);
        if (results[0].status === "fulfilled") setEvents(results[0].value.events);
        if (results[1].status === "fulfilled") setPointHistory(results[1].value.transactions);
        if (results[2].status === "fulfilled") setScoutAttendance(results[2].value.summary);
        if (results[3].status === "fulfilled") {
          setGallery(results[3].value.summary);
          setGalleryError(false);
        } else setGalleryError(true);

        const failures = results.filter((result) => result.status === "rejected").length;
        if (failures) setError(`${failures} dashboard source${failures === 1 ? "" : "s"} could not be refreshed.`);
        if (failures < results.length) setLastUpdated(new Date());
        return;
      }

      const results = await Promise.allSettled([
        api.scouts.list(),
        api.events.list(),
        api.attendance.sessions.list(),
        api.finance.summary(),
        api.gallery.summary(4),
        role === "ADMIN" ? api.users.list() : Promise.resolve({ users: [] }),
      ] as const);
      if (results[0].status === "fulfilled") setScouts(results[0].value.scouts);
      if (results[1].status === "fulfilled") setEvents(results[1].value.events);
      if (results[2].status === "fulfilled") setSessions(results[2].value.sessions);
      if (results[3].status === "fulfilled") setFinance(results[3].value.summary);
      if (results[4].status === "fulfilled") {
        setGallery(results[4].value.summary);
        setGalleryError(false);
      } else setGalleryError(true);
      if (results[5].status === "fulfilled") setAccounts(results[5].value.users);

      const failures = results.filter((result) => result.status === "rejected").length;
      if (failures) setError(`${failures} dashboard source${failures === 1 ? "" : "s"} could not be refreshed.`);
      if (failures < results.length) setLastUpdated(new Date());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Dashboard data could not be refreshed.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isScout, role, scoutId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [load]);

  const currentDate = today();
  const upcomingEvents = useMemo(
    () => events.filter((event) => event.endDate >= currentDate).sort((left, right) => `${left.startDate}${left.startTime}`.localeCompare(`${right.startDate}${right.startTime}`)),
    [currentDate, events],
  );
  const nextEvent = upcomingEvents[0] || null;
  const activeScouts = scouts.filter((scout) => scout.status === "Active").length;
  const recordedAttendance = sessions.reduce((total, session) => total + session.summary.totalScouts, 0);
  const presentAttendance = sessions.reduce((total, session) => total + session.summary.present + session.summary.late, 0);
  const attendanceRate = recordedAttendance ? Math.round((presentAttendance / recordedAttendance) * 100) : 0;
  const emptyAttendance = sessions.filter((session) => session.meetingDate <= currentDate && session.summary.totalScouts === 0);
  const recentSessions = sessions.filter((session) => session.summary.totalScouts > 0).slice(0, 3);
  const totalPoints = pointHistory.reduce((total, transaction) => total + transaction.pointsChange, 0);

  const units = useMemo(() => {
    const grouped = new Map<string, { total: number; active: number }>();
    for (const scout of scouts) {
      const current = grouped.get(scout.unit) || { total: 0, active: 0 };
      current.total += 1;
      if (scout.status === "Active") current.active += 1;
      grouped.set(scout.unit, current);
    }
    return [...grouped.entries()].sort(([left], [right]) => left.localeCompare(right));
  }, [scouts]);

  const accountAlerts = accounts.filter((account) => ["EXPIRED", "INVITATION_FAILED"].includes(account.accountState)).length;
  const pendingInvitations = accounts.filter((account) => account.accountState === "INVITED").length;
  const inactiveScouts = scouts.length - activeScouts;
  const alerts = [
    ...(emptyAttendance.length ? [{ label: "Attendance sessions with no records", value: emptyAttendance.length, to: "/attendance" }] : []),
    ...(finance?.pending ? [{ label: "Finance submissions awaiting approval", value: finance.pending, to: "/finance" }] : []),
    ...(role === "ADMIN" && accountAlerts ? [{ label: "Expired or failed account invitations", value: accountAlerts, to: "/users" }] : []),
    ...(role === "ADMIN" && pendingInvitations ? [{ label: "Account invitations awaiting acceptance", value: pendingInvitations, to: "/users" }] : []),
    ...(inactiveScouts ? [{ label: "Inactive Scout records", value: inactiveScouts, to: "/scouts" }] : []),
  ];

  const leaderMetrics = [
    { label: "Active scouts", value: loading ? "—" : String(activeScouts), detail: `${scouts.length} visible`, icon: "users" as const, tone: "green" },
    { label: "Upcoming events", value: loading ? "—" : String(upcomingEvents.length), detail: nextEvent ? formatDate(nextEvent.startDate) : "None scheduled", icon: "calendar" as const, tone: "gold" },
    { label: "Recorded attendance", value: recordedAttendance ? `${attendanceRate}%` : "—", detail: recordedAttendance ? `${recordedAttendance} records` : "No records", icon: "attendance" as const, tone: "blue" },
    { label: finance && finance.balance < 0 ? "Amount owed" : "Finance balance", value: finance ? formatMoney(finance.balance) : "—", detail: finance ? `${finance.pending} awaiting approval` : "Unavailable", icon: "wallet" as const, tone: finance && finance.balance < 0 ? "red" : "green" },
  ];
  const scoutMetrics = [
    { label: "My points", value: loading ? "—" : String(totalPoints), detail: "Current total", icon: "shield" as const, tone: "gold" },
    { label: "My attendance", value: scoutAttendance?.total ? `${scoutAttendance.attendancePercentage}%` : "—", detail: scoutAttendance?.total ? `${scoutAttendance.total} records` : "No records", icon: "attendance" as const, tone: "green" },
    { label: "Upcoming events", value: loading ? "—" : String(upcomingEvents.length), detail: nextEvent ? formatDate(nextEvent.startDate) : "None scheduled", icon: "calendar" as const, tone: "blue" },
  ];
  const assignedUnitCount = user?.assignedUnits?.length || (user?.unit ? 1 : 0);
  const scopeLabel = role === "UNIT_LEADER"
    ? `${assignedUnitCount} assigned unit${assignedUnitCount === 1 ? "" : "s"}`
    : role === "SCOUT" ? "My Scout record" : "Whole group";

  return (
    <div className="page dashboard-page">
      <section className="hero-panel">
        <div>
          <span className="eyebrow">ScoutOS workspace</span>
          <h1>Welcome, {user?.fullName || user?.username || "there"}.</h1>
          <p>{isScout ? "Your progress, attendance, and next group activity in one place." : "The current operational picture inside your authorized scope."}</p>
        </div>
        <Link className="button button-light" to={isScout ? "/my-profile" : "/scouts"}>
          <Icon name={isScout ? "eye" : "users"} size={18} />
          {isScout ? "View my profile" : "Manage scouts"}
        </Link>
      </section>

      <div className="dashboard-status-bar">
        <span><strong>{scopeLabel}</strong> · {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Waiting for live data"}</span>
        <button disabled={loading || refreshing} onClick={() => { void load(true); }} type="button">{refreshing ? "Refreshing…" : "Refresh dashboard"}</button>
      </div>
      {error && <div className="form-error page-error">{error} The other cards still show the latest available data.</div>}

      <section className={`metrics-grid ${isScout ? "" : "dashboard-metrics"}`}>
        {(isScout ? scoutMetrics : leaderMetrics).map((metric) => (
          <article className="metric-card" key={metric.label}>
            <span className={`metric-icon ${metric.tone}`}><Icon name={metric.icon} size={23} /></span>
            <div><p>{metric.label}</p><strong>{metric.value}</strong><small>{metric.detail}</small></div>
          </article>
        ))}
      </section>

      <section className="dashboard-grid">
        <article className="panel dashboard-command-panel">
          <div className="panel-heading"><div><span className="eyebrow">Coming up</span><h2>Next event</h2></div><Link to="/events">All events</Link></div>
          {nextEvent ? <div className="dashboard-next-event">
            <div className="event-date"><strong>{new Date(`${nextEvent.startDate}T12:00:00`).getDate()}</strong><span>{new Date(`${nextEvent.startDate}T12:00:00`).toLocaleDateString("en-GB", { month: "short" }).toUpperCase()}</span></div>
            <div className="event-copy"><strong>{nextEvent.title}</strong><span>{nextEvent.eventType} · {nextEvent.location || "Location to be confirmed"}</span><small>{nextEvent.registrationCount} registered{nextEvent.capacity ? ` of ${nextEvent.capacity}` : ""}</small></div>
            <Link className="round-button" aria-label={`View ${nextEvent.title}`} to="/events"><Icon name="chevron" size={17} /></Link>
          </div> : <div className="dashboard-panel-empty">No upcoming events are scheduled.</div>}
        </article>

        {isScout ? <article className="panel dashboard-command-panel">
          <div className="panel-heading"><div><span className="eyebrow">Recent record</span><h2>My attendance</h2></div><Link to="/my-profile">Full history</Link></div>
          <div className="dashboard-activity-list">
            {(scoutAttendance?.history || []).slice(0, 3).map((record) => <div className="dashboard-activity-row" key={record.sessionId}><span className={`dashboard-state ${record.status}`}>{record.status}</span><div><strong>{record.meetingName}</strong><small>{formatDate(record.meetingDate)} · {record.location || "No location"}</small></div></div>)}
            {!scoutAttendance?.history?.length && <div className="dashboard-panel-empty">No attendance has been recorded yet.</div>}
          </div>
        </article> : <article className="panel dashboard-command-panel">
          <div className="panel-heading"><div><span className="eyebrow">Needs action</span><h2>Attention</h2></div></div>
          <div className="dashboard-alert-list">
            {alerts.map((alert) => <Link key={alert.label} to={alert.to}><span>{alert.label}</span><strong>{alert.value}</strong><Icon name="chevron" size={15} /></Link>)}
            {!alerts.length && <div className="dashboard-panel-empty">No actionable alerts were found in the loaded data.</div>}
          </div>
        </article>}

        {!isScout && <article className="panel dashboard-command-panel">
          <div className="panel-heading"><div><span className="eyebrow">Authorized scope</span><h2>Scouts by unit</h2></div><Link to="/scouts">Scout records</Link></div>
          <div className="dashboard-unit-list">
            {units.map(([unit, count]) => <div key={unit}><span><strong>{unit}</strong><small>{count.active} active of {count.total}</small></span><div><i style={{ width: `${count.total ? (count.active / count.total) * 100 : 0}%` }} /></div></div>)}
            {!units.length && <div className="dashboard-panel-empty">No Scout records are visible in this scope.</div>}
          </div>
        </article>}

        {!isScout && <article className="panel dashboard-command-panel">
          <div className="panel-heading"><div><span className="eyebrow">Latest records</span><h2>Attendance</h2></div><Link to="/attendance-history">Full history</Link></div>
          <div className="dashboard-activity-list">
            {recentSessions.map((session) => <div className="dashboard-activity-row" key={session.id}><span className="dashboard-rate">{session.summary.attendanceRate}%</span><div><strong>{session.meetingName}</strong><small>{formatDate(session.meetingDate)} · {session.summary.totalScouts} Scouts recorded</small></div></div>)}
            {!recentSessions.length && <div className="dashboard-panel-empty">No completed attendance records yet.</div>}
          </div>
        </article>}

        <DashboardGalleryPreview error={galleryError} loading={loading && !gallery} summary={gallery} />
      </section>
    </div>
  );
}

export default Dashboard;
