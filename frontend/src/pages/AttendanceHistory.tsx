import { useEffect, useMemo, useState } from "react";
import Icon from "../components/Icon";
import {
  api,
  getStoredUser,
  scoutUnits,
  type AttendanceSession,
  type AttendanceStatus,
  type ScoutUnit,
} from "../lib/api";

type HistoryStatus = "all" | AttendanceStatus;

function AttendanceHistory() {
  const user = getStoredUser();
  const availableUnits: ScoutUnit[] = user?.role === "UNIT_LEADER"
    ? user.assignedUnits?.map((unit) => unit.name) || (user.unit ? [user.unit] : [])
    : [...scoutUnits];
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [unit, setUnit] = useState<"all" | ScoutUnit>("all");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [status, setStatus] = useState<HistoryStatus>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.attendance.sessions.list({ unit: unit === "all" ? "" : unit })
      .then(({ sessions: records }) => setSessions(records))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load attendance history."))
      .finally(() => setLoading(false));
  }, [unit]);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sessions.filter((session) => {
      const matchesSearch = !query || [session.meetingName, session.meetingType, session.location]
        .join(" ").toLowerCase().includes(query);
      const matchesDate = !date || session.meetingDate === date;
      const matchesStatus = status === "all" || session.summary[status] > 0;
      return matchesSearch && matchesDate && matchesStatus;
    });
  }, [date, search, sessions, status]);

  return (
    <div className="page">
      <header className="page-header">
        <div><span className="eyebrow">Saved records</span><h1>Attendance History</h1><p>Review only the sessions and Scout totals inside your authorized unit scope.</p></div>
      </header>
      {error && <div className="form-error page-error">{error}</div>}
      <section className="panel table-panel">
        <div className="toolbar attendance-history-filters">
          <label className="search-field"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search meeting or location…" /></label>
          <select aria-label="Unit" value={unit} onChange={(event) => { setLoading(true); setError(""); setUnit(event.target.value as "all" | ScoutUnit); }}><option value="all">{user?.role === "UNIT_LEADER" ? "All My Units" : "All Units"}</option>{availableUnits.map((name) => <option key={name} value={name}>{name}</option>)}</select>
          <input aria-label="Meeting date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <select aria-label="Attendance status" value={status} onChange={(event) => setStatus(event.target.value as HistoryStatus)}><option value="all">All statuses</option><option value="present">Has present</option><option value="absent">Has absent</option><option value="late">Has late</option><option value="excused">Has excused</option></select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Meeting Name</th><th>Type</th><th>Scouts</th><th>Present</th><th>Absent</th><th>Late</th><th>Excused</th><th>Rate</th></tr></thead>
            <tbody>{filteredSessions.map((session) => <tr key={session.id}><td>{session.meetingDate}</td><td>{session.meetingName}</td><td>{session.meetingType}</td><td>{session.summary.totalScouts}</td><td>{session.summary.present}</td><td>{session.summary.absent}</td><td>{session.summary.late}</td><td>{session.summary.excused}</td><td><strong>{session.summary.attendanceRate}%</strong></td></tr>)}</tbody>
          </table>
          {loading && <div className="empty-state"><p>Loading history…</p></div>}
          {!loading && filteredSessions.length === 0 && <div className="empty-state"><span><Icon name="attendance" size={25} /></span><h3>No matching attendance</h3><p>Try another authorized unit, date, status, or search.</p></div>}
        </div>
      </section>
    </div>
  );
}

export default AttendanceHistory;
