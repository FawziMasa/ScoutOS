import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon";
import {
  api,
  getStoredUser,
  type PointsTransaction,
  type Scout,
  type ScoutAttendanceProfileSummary,
} from "../lib/api";

function ScoutPortal() {
  const user = getStoredUser();
  const [scout, setScout] = useState<Scout | null>(null);
  const [points, setPoints] = useState<PointsTransaction[]>([]);
  const [attendance, setAttendance] = useState<ScoutAttendanceProfileSummary | null>(null);
  const [loading, setLoading] = useState(Boolean(user?.scoutId));
  const [error, setError] = useState(
    user?.scoutId ? "" : "This account is not linked to a Scout record. Ask an Admin to repair the account link.",
  );
  const totalPoints = useMemo(
    () => points.reduce((total, transaction) => total + transaction.pointsChange, 0),
    [points],
  );

  useEffect(() => {
    if (!user?.scoutId) {
      return;
    }
    Promise.all([
      api.scouts.get(user.scoutId),
      api.points.history(user.scoutId),
      api.attendance.scoutSummary(user.scoutId),
    ]).then(([scoutResult, pointsResult, attendanceResult]) => {
      setScout(scoutResult.scout);
      setPoints(pointsResult.transactions);
      setAttendance(attendanceResult.summary);
    }).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Could not load your Scout profile.");
    }).finally(() => setLoading(false));
  }, [user?.scoutId]);

  if (loading) {
    return <div className="page"><section className="panel"><p>Loading your Scout profile…</p></section></div>;
  }

  return (
    <div className="page">
      <header className="page-header">
        <div><span className="eyebrow">Scout portal</span><h1>My Profile</h1><p>Your own points and attendance history.</p></div>
      </header>
      {error && <div className="form-error page-error">{error}</div>}
      {scout && <>
        <section className="hero-panel">
          <div><span className="eyebrow">{scout.unit}</span><h1>{scout.name}</h1><p>Joined {String(scout.joinedAt || "").slice(0, 10) || "date unavailable"}</p></div>
          <span className={"status-pill " + scout.status.toLowerCase()}>{scout.status}</span>
        </section>
        <section className="metrics-grid">
          <article className="metric-card"><span className="metric-icon gold"><Icon name="shield" size={23} /></span><div><p>Total points</p><strong>{totalPoints}</strong><small>{points.length} transactions</small></div></article>
          <article className="metric-card"><span className="metric-icon green"><Icon name="attendance" size={23} /></span><div><p>Attendance rate</p><strong>{attendance?.attendancePercentage ?? 0}%</strong><small>{attendance?.total ?? 0} meetings</small></div></article>
          <article className="metric-card"><span className="metric-icon blue"><Icon name="calendar" size={23} /></span><div><p>Present or late</p><strong>{(attendance?.present ?? 0) + (attendance?.late ?? 0)}</strong><small>Recorded sessions</small></div></article>
        </section>
        <section className="dashboard-grid">
          <article className="panel table-panel"><h2>Point history</h2><div className="table-wrap"><table><thead><tr><th>Change</th><th>Reason</th><th>Leader</th><th>Date</th></tr></thead><tbody>{points.map((transaction) => <tr key={transaction.id}><td><strong>{transaction.pointsChange > 0 ? "+" + transaction.pointsChange : transaction.pointsChange}</strong></td><td>{transaction.reason}</td><td>{transaction.leaderName || "Leader"}</td><td>{new Date(transaction.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table>{points.length === 0 && <div className="empty-state"><p>No point transactions yet.</p></div>}</div></article>
          <article className="panel table-panel"><h2>Attendance history</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Meeting</th><th>Status</th></tr></thead><tbody>{attendance?.history.map((record) => <tr key={record.sessionId + "-" + record.meetingDate}><td>{record.meetingDate}</td><td>{record.meetingName}</td><td><span className={"status-pill " + record.status}>{record.status}</span></td></tr>)}</tbody></table>{!attendance?.history.length && <div className="empty-state"><p>No attendance records yet.</p></div>}</div></article>
        </section>
      </>}
    </div>
  );
}

export default ScoutPortal;
