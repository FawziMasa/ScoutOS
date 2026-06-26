import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Icon from "../components/Icon";
import {
  api,
  attendanceStatuses,
  meetingTypes,
  type AttendanceRecord,
  type AttendanceSaveRecord,
  type AttendanceSession,
  type AttendanceSessionInput,
  type AttendanceStatus,
  type MeetingType,
  type Scout,
} from "../lib/api";

type Tab = "take" | "history";
type SortBy = "alphabetical" | "patrol" | "rank" | "newest";
type StatusFilter = "all" | AttendanceStatus;
type ToastType = "success" | "error";
type DraftRecord = Pick<AttendanceSaveRecord, "status" | "arrivalTime" | "notes">;
type ScoutWithLegacyDates = Scout & {
  joined_at?: string;
  created_at?: string;
};

const statusLabels: Record<AttendanceStatus, string> = {
  present: "Present",
  absent: "Absent",
  late: "Late",
  excused: "Excused",
};

const statusDescriptions: Record<AttendanceStatus, string> = {
  present: "Checked in",
  absent: "Not attended",
  late: "Arrived late",
  excused: "Approved absence",
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptySessionForm(): AttendanceSessionInput {
  return {
    meetingName: "",
    meetingType: "Weekly Meeting",
    meetingDate: today(),
    startTime: "",
    endTime: "",
    location: "",
    notes: "",
  };
}

function formFromSession(session: AttendanceSession): AttendanceSessionInput {
  return {
    meetingName: session.meetingName,
    meetingType: session.meetingType,
    meetingDate: session.meetingDate,
    startTime: session.startTime,
    endTime: session.endTime,
    location: session.location,
    notes: session.notes,
  };
}

function emptyDraft(status: AttendanceStatus = "absent"): DraftRecord {
  return {
    status,
    arrivalTime: "",
    notes: "",
  };
}

function buildDrafts(scouts: Scout[], savedRecords: AttendanceRecord[] = []) {
  const savedByScout = new Map(savedRecords.map((record) => [record.scoutId, record]));

  return scouts.reduce<Record<string, DraftRecord>>((drafts, scout) => {
    const saved = savedByScout.get(scout.id);
    drafts[scout.id] = saved
      ? {
          status: saved.status,
          arrivalTime: saved.arrivalTime,
          notes: saved.notes,
        }
      : emptyDraft();
    return drafts;
  }, {});
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function scoutJoinedAt(scout: Scout) {
  const record = scout as ScoutWithLegacyDates;
  return scout.joinedAt || record.joined_at || "";
}

function scoutCreatedAt(scout: Scout) {
  const record = scout as ScoutWithLegacyDates;
  return scout.createdAt || record.created_at || scoutJoinedAt(scout);
}

function scoutPatrol(scout: Scout) {
  return scout.patrol || "Not assigned";
}

function scoutRank(scout: Scout) {
  return scout.rank || scout.unit || "Not set";
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeRange(session: AttendanceSession) {
  if (!session.startTime && !session.endTime) return "No time set";
  if (session.startTime && session.endTime) return `${session.startTime} - ${session.endTime}`;
  return session.startTime || session.endTime;
}

function calculateSummary(scouts: Scout[], records: Record<string, DraftRecord>) {
  const summary = {
    totalScouts: scouts.length,
    present: 0,
    absent: 0,
    late: 0,
    excused: 0,
    attendanceRate: 0,
  };

  for (const scout of scouts) {
    const status = records[scout.id]?.status || "absent";
    summary[status] += 1;
  }

  summary.attendanceRate = summary.totalScouts > 0
    ? Math.round(((summary.present + summary.late) / summary.totalScouts) * 100)
    : 0;

  return summary;
}

function Attendance() {
  const [tab, setTab] = useState<Tab>("take");
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionForm, setSessionForm] = useState<AttendanceSessionInput>(createEmptySessionForm);
  const [records, setRecords] = useState<Record<string, DraftRecord>>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortBy, setSortBy] = useState<SortBy>("alphabetical");
  const [loading, setLoading] = useState(true);
  const [loadingSession, setLoadingSession] = useState(false);
  const [savingSession, setSavingSession] = useState(false);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [hasSavedRecords, setHasSavedRecords] = useState(false);
  const [toast, setToast] = useState<{ type: ToastType; message: string } | null>(null);

  function showToast(message: string, type: ToastType = "success") {
    setToast({ message, type });
    window.setTimeout(() => {
      setToast((current) => (current?.message === message ? null : current));
    }, 3800);
  }

  useEffect(() => {
    let mounted = true;

    async function loadAttendanceWorkspace() {
      try {
        setLoading(true);
        const [{ sessions: sessionRecords }, { scouts: scoutRecords }] = await Promise.all([
          api.attendance.sessions.list(),
          api.scouts.list(),
        ]);

        if (!mounted) return;
        setSessions(sessionRecords);
        setScouts(scoutRecords);
        setRecords(buildDrafts(scoutRecords));
      } catch (error) {
        if (mounted) {
          showToast(error instanceof Error ? error.message : "Could not load attendance.", "error");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadAttendanceWorkspace();

    return () => {
      mounted = false;
    };
  }, []);

  const summary = useMemo(() => calculateSummary(scouts, records), [scouts, records]);

  const filteredScouts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...scouts]
      .filter((scout) => {
        const draft = records[scout.id] || emptyDraft();
        const matchesStatus = statusFilter === "all" || draft.status === statusFilter;
        const searchText = [
          scout.name,
          scout.id,
          scout.unit,
          scoutPatrol(scout),
          scoutRank(scout),
        ].join(" ").toLowerCase();

        return matchesStatus && searchText.includes(query);
      })
      .sort((left, right) => {
        if (sortBy === "patrol") {
          return scoutPatrol(left).localeCompare(scoutPatrol(right));
        }

        if (sortBy === "rank") {
          return scoutRank(left).localeCompare(scoutRank(right));
        }

        if (sortBy === "newest") {
          return scoutCreatedAt(right).localeCompare(scoutCreatedAt(left));
        }

        return left.name.localeCompare(right.name);
      });
  }, [records, scouts, search, sortBy, statusFilter]);

  function updateSessionField<Key extends keyof AttendanceSessionInput>(
    key: Key,
    value: AttendanceSessionInput[Key],
  ) {
    setSessionForm((current) => ({ ...current, [key]: value }));
  }

  async function refreshSessions() {
    const { sessions: sessionRecords } = await api.attendance.sessions.list();
    setSessions(sessionRecords);
    return sessionRecords;
  }

  async function openSession(session: AttendanceSession) {
    try {
      setLoadingSession(true);
      const detail = await api.attendance.sessions.get(session.id);
      setActiveSession(detail.session);
      setSessionForm(formFromSession(detail.session));
      setRecords(buildDrafts(scouts, detail.records));
      setHasSavedRecords(detail.records.length > 0);
      setTab("take");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not open session.", "error");
    } finally {
      setLoadingSession(false);
    }
  }

  function startNewSession() {
    setActiveSession(null);
    setHasSavedRecords(false);
    setSessionForm(createEmptySessionForm());
    setRecords(buildDrafts(scouts));
    setTab("take");
  }

  async function handleSessionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!sessionForm.meetingName.trim()) {
      showToast("Meeting Name Required", "error");
      return;
    }

    if (!sessionForm.meetingDate) {
      showToast("Meeting Date Required", "error");
      return;
    }

    try {
      setSavingSession(true);
      const result = activeSession
        ? await api.attendance.sessions.update(activeSession.id, sessionForm)
        : await api.attendance.sessions.create(sessionForm);

      setActiveSession(result.session);
      setSessionForm(formFromSession(result.session));
      setSessions((current) => [
        result.session,
        ...current.filter((session) => session.id !== result.session.id),
      ]);
      setRecords((current) => Object.keys(current).length ? current : buildDrafts(scouts));
      showToast(activeSession ? "Session Updated" : "Session Created");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save session.", "error");
    } finally {
      setSavingSession(false);
    }
  }

  function updateRecord(scoutId: string, update: Partial<DraftRecord>) {
    setRecords((current) => ({
      ...current,
      [scoutId]: {
        ...(current[scoutId] || emptyDraft()),
        ...update,
      },
    }));
  }

  function updateStatus(scoutId: string, status: AttendanceStatus) {
    setRecords((current) => {
      const existing = current[scoutId] || emptyDraft();
      return {
        ...current,
        [scoutId]: {
          ...existing,
          status,
          arrivalTime: status === "absent" || status === "excused" ? "" : existing.arrivalTime,
        },
      };
    });
  }

  function selectAllPresent() {
    setRecords(
      scouts.reduce<Record<string, DraftRecord>>((drafts, scout) => {
        drafts[scout.id] = {
          ...(records[scout.id] || emptyDraft()),
          status: "present",
        };
        return drafts;
      }, {}),
    );
    showToast("All visible scouts marked present.");
  }

  function clearAll() {
    setRecords(buildDrafts(scouts));
    showToast("Attendance cleared.");
  }

  async function saveCurrentAttendance() {
    if (!activeSession) {
      showToast("Cannot save without session.", "error");
      return;
    }

    if (scouts.length === 0) {
      showToast("Cannot save empty attendance.", "error");
      return;
    }

    const payload: AttendanceSaveRecord[] = scouts.map((scout) => ({
      scoutId: scout.id,
      ...(records[scout.id] || emptyDraft()),
    }));

    try {
      setSavingAttendance(true);
      const result = await api.attendance.save({
        sessionId: activeSession.id,
        records: payload,
      });

      setActiveSession(result.session);
      setRecords(buildDrafts(scouts, result.records));
      setHasSavedRecords(true);
      await refreshSessions();
      showToast(result.updated ? "Attendance Updated Successfully" : "Attendance Saved Successfully");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save attendance.", "error");
    } finally {
      setSavingAttendance(false);
    }
  }

  async function deleteSession(session: AttendanceSession) {
    if (!window.confirm(`Delete ${session.meetingName}? Attendance records will be removed too.`)) {
      return;
    }

    try {
      await api.attendance.sessions.remove(session.id);
      setSessions((current) => current.filter((record) => record.id !== session.id));
      if (activeSession?.id === session.id) startNewSession();
      showToast("Session Deleted");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not delete session.", "error");
    }
  }

  return (
    <div className="page attendance-page">
      {toast && (
        <div className={`toast toast-${toast.type}`} role="status">
          <Icon name={toast.type === "success" ? "check" : "x"} size={17} />
          <span>{toast.message}</span>
        </div>
      )}

      <header className="page-header">
        <div>
          <span className="eyebrow">Participation</span>
          <h1>Take Attendance</h1>
          <p>Record attendance for today's meeting and keep a real history for every scout.</p>
        </div>
        <button className="button button-primary" onClick={startNewSession} type="button">
          <Icon name="plus" size={18} />
          New session
        </button>
      </header>

      <div className="attendance-tabs" role="tablist" aria-label="Attendance views">
        <button
          className={tab === "take" ? "active" : ""}
          onClick={() => setTab("take")}
          type="button"
        >
          Take Attendance
        </button>
        <button
          className={tab === "history" ? "active" : ""}
          onClick={() => setTab("history")}
          type="button"
        >
          Attendance History
        </button>
      </div>

      {tab === "take" && (
        <>
          <section className="attendance-session-card">
            <div className="panel-heading attendance-heading">
              <div>
                <span className="eyebrow">{activeSession ? "Session details" : "New session"}</span>
                <h2>{activeSession ? activeSession.meetingName : "Create meeting session"}</h2>
              </div>
              {activeSession && (
                <span className="session-badge">
                  {hasSavedRecords ? "Saved attendance" : "Ready to record"}
                </span>
              )}
            </div>

            <form className="attendance-form" onSubmit={handleSessionSubmit}>
              <label className="field">
                <span>Meeting Name</span>
                <input
                  required
                  value={sessionForm.meetingName}
                  onChange={(event) => updateSessionField("meetingName", event.target.value)}
                  placeholder="Friday weekly meeting"
                />
              </label>

              <label className="field">
                <span>Meeting Type</span>
                <select
                  value={sessionForm.meetingType}
                  onChange={(event) => updateSessionField("meetingType", event.target.value as MeetingType)}
                >
                  {meetingTypes.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Meeting Date</span>
                <input
                  required
                  type="date"
                  value={sessionForm.meetingDate}
                  onChange={(event) => updateSessionField("meetingDate", event.target.value)}
                />
              </label>

              <label className="field">
                <span>Start Time</span>
                <input
                  type="time"
                  value={sessionForm.startTime}
                  onChange={(event) => updateSessionField("startTime", event.target.value)}
                />
              </label>

              <label className="field">
                <span>End Time</span>
                <input
                  type="time"
                  value={sessionForm.endTime}
                  onChange={(event) => updateSessionField("endTime", event.target.value)}
                />
              </label>

              <label className="field">
                <span>Location</span>
                <input
                  value={sessionForm.location}
                  onChange={(event) => updateSessionField("location", event.target.value)}
                  placeholder="Scout hall"
                />
              </label>

              <label className="field field-wide">
                <span>Notes</span>
                <textarea
                  value={sessionForm.notes}
                  onChange={(event) => updateSessionField("notes", event.target.value)}
                  placeholder="Optional meeting notes"
                />
              </label>

              <div className="form-actions field-wide">
                <button className="button button-secondary" onClick={startNewSession} type="button">
                  Cancel
                </button>
                <button className="button button-primary" disabled={savingSession} type="submit">
                  <Icon name="check" size={18} />
                  {savingSession ? "Saving..." : activeSession ? "Update Session" : "Create Session"}
                </button>
              </div>
            </form>
          </section>

          {activeSession && (
            <section className="attendance-summary-grid">
              <article><span>Total Scouts</span><strong>{summary.totalScouts}</strong></article>
              <article><span>Present</span><strong>{summary.present}</strong></article>
              <article><span>Absent</span><strong>{summary.absent}</strong></article>
              <article><span>Late</span><strong>{summary.late}</strong></article>
              <article><span>Excused</span><strong>{summary.excused}</strong></article>
              <article className="rate-card"><span>Attendance Rate</span><strong>{summary.attendanceRate}%</strong></article>
            </section>
          )}

          <section className="panel attendance-list-card">
            <div className="attendance-list-header">
              <div>
                <span className="eyebrow">Scout list</span>
                <h2>{activeSession ? "Mark attendance" : "Create a session first"}</h2>
              </div>
              {activeSession && (
                <div className="attendance-actions">
                  <button className="button button-secondary" onClick={selectAllPresent} type="button">
                    Select All Present
                  </button>
                  <button className="button button-secondary" onClick={clearAll} type="button">
                    Clear All
                  </button>
                </div>
              )}
            </div>

            <div className="toolbar attendance-toolbar">
              <label className="search-field">
                <Icon name="search" size={18} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, Scout ID, or patrol..."
                />
              </label>

              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="all">All</option>
                {attendanceStatuses.map((status) => (
                  <option key={status} value={status}>{statusLabels[status]}</option>
                ))}
              </select>

              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)}>
                <option value="alphabetical">Alphabetical</option>
                <option value="patrol">Patrol</option>
                <option value="rank">Rank</option>
                <option value="newest">Newest</option>
              </select>
            </div>

            {!activeSession && (
              <div className="empty-state">
                <span><Icon name="calendar" size={25} /></span>
                <h3>No active attendance session</h3>
                <p>Create a meeting session above, then ScoutOS will load the scout list for attendance.</p>
              </div>
            )}

            {activeSession && loading && (
              <div className="empty-state"><p>Loading attendance workspace...</p></div>
            )}

            {activeSession && !loading && filteredScouts.length === 0 && (
              <div className="empty-state">
                <span><Icon name={scouts.length === 0 ? "scouts" : "search"} size={25} /></span>
                <h3>{scouts.length === 0 ? "No scouts found" : "No matching scouts"}</h3>
                <p>{scouts.length === 0 ? "Add scouts first, then return to attendance." : "Try another search or status filter."}</p>
              </div>
            )}

            {activeSession && filteredScouts.length > 0 && (
              <div className="attendance-scout-list">
                {filteredScouts.map((scout) => {
                  const draft = records[scout.id] || emptyDraft();

                  return (
                    <article className="attendance-scout-row" key={scout.id}>
                      <div className="attendance-scout-profile">
                        <span className="person-avatar">{initials(scout.name)}</span>
                        <div>
                          <strong>{scout.name}</strong>
                          <span>ID: {scout.id}</span>
                        </div>
                      </div>

                      <div className="attendance-scout-meta">
                        <span>Patrol</span>
                        <strong>{scoutPatrol(scout)}</strong>
                      </div>

                      <div className="attendance-scout-meta">
                        <span>Rank</span>
                        <strong>{scoutRank(scout)}</strong>
                      </div>

                      <div className="attendance-status-group" aria-label={`Attendance status for ${scout.name}`}>
                        {attendanceStatuses.map((status) => (
                          <label className={`status-choice ${draft.status === status ? "active" : ""}`} key={status}>
                            <input
                              checked={draft.status === status}
                              name={`status-${scout.id}`}
                              onChange={() => updateStatus(scout.id, status)}
                              type="radio"
                              value={status}
                            />
                            <span>{statusLabels[status]}</span>
                            <small>{statusDescriptions[status]}</small>
                          </label>
                        ))}
                      </div>

                      <label className="field attendance-time-field">
                        <span>Arrival Time</span>
                        <input
                          disabled={draft.status === "absent" || draft.status === "excused"}
                          type="time"
                          value={draft.arrivalTime}
                          onChange={(event) => updateRecord(scout.id, { arrivalTime: event.target.value })}
                        />
                      </label>

                      <label className="field attendance-note-field">
                        <span>Optional Notes</span>
                        <input
                          value={draft.notes}
                          onChange={(event) => updateRecord(scout.id, { notes: event.target.value })}
                          placeholder="Traffic, parent note..."
                        />
                      </label>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          {activeSession && (
            <div className="attendance-sticky-footer">
              <div>
                <strong>{activeSession.meetingName}</strong>
                <span>{formatDate(activeSession.meetingDate)} · {summary.attendanceRate}% attendance</span>
              </div>
              <div>
                <button className="button button-secondary" onClick={startNewSession} type="button">
                  Cancel
                </button>
                <button
                  className="button button-primary"
                  disabled={savingAttendance}
                  onClick={saveCurrentAttendance}
                  type="button"
                >
                  <Icon name="check" size={18} />
                  {savingAttendance ? "Saving..." : "Save Attendance"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <section className="panel table-panel attendance-history-panel">
          <div className="panel-heading attendance-heading">
            <div>
              <span className="eyebrow">Saved records</span>
              <h2>Attendance History</h2>
            </div>
            <button className="button button-secondary" onClick={refreshSessions} type="button">
              Refresh
            </button>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Meeting</th>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Type</th>
                  <th>Scouts</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Late</th>
                  <th>Excused</th>
                  <th>Rate</th>
                  <th><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>
                      <div className="person-cell">
                        <span className="person-avatar"><Icon name="attendance" size={18} /></span>
                        <div>
                          <strong>{session.meetingName}</strong>
                          <span>{formatTimeRange(session)}</span>
                        </div>
                      </div>
                    </td>
                    <td>{formatDate(session.meetingDate)}</td>
                    <td>{session.location || "—"}</td>
                    <td><span className="unit-pill">{session.meetingType}</span></td>
                    <td>{session.summary.totalScouts}</td>
                    <td>{session.summary.present}</td>
                    <td>{session.summary.absent}</td>
                    <td>{session.summary.late}</td>
                    <td>{session.summary.excused}</td>
                    <td><strong>{session.summary.attendanceRate}%</strong></td>
                    <td>
                      <div className="table-actions">
                        <button aria-label={`Open ${session.meetingName}`} onClick={() => openSession(session)} type="button">
                          <Icon name="calendar" size={17} />
                        </button>
                        <button aria-label={`Edit ${session.meetingName}`} onClick={() => openSession(session)} type="button">
                          <Icon name="edit" size={17} />
                        </button>
                        <button className="danger" aria-label={`Delete ${session.meetingName}`} onClick={() => deleteSession(session)} type="button">
                          <Icon name="trash" size={17} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!loading && sessions.length === 0 && (
              <div className="empty-state">
                <span><Icon name="attendance" size={25} /></span>
                <h3>No attendance sessions yet</h3>
                <p>Create your first session from the Take Attendance tab.</p>
              </div>
            )}

            {loadingSession && (
              <div className="empty-state"><p>Opening session...</p></div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default Attendance;
