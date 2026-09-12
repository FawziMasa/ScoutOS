import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Icon from "../components/Icon";
import { api, eventTypes, getStoredUser, type EventType, type Scout, type ScoutEvent, type ScoutEventInput } from "../lib/api";

type DateFilter = "upcoming" | "all" | "past";

function today() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyEvent(): ScoutEventInput {
  return { title: "", eventType: "Weekly Meeting", startDate: today(), endDate: today(), startTime: "", endTime: "", location: "", capacity: null, notes: "" };
}

function formFromEvent(event: ScoutEvent): ScoutEventInput {
  return { title: event.title, eventType: event.eventType, startDate: event.startDate, endDate: event.endDate, startTime: event.startTime, endTime: event.endTime, location: event.location, capacity: event.capacity, notes: event.notes };
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function timeRange(event: ScoutEvent) {
  if (!event.startTime && !event.endTime) return "Time to be confirmed";
  return event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : event.startTime || event.endTime;
}

function Events() {
  const user = getStoredUser();
  const canManage = user?.role !== "SCOUT";
  const [events, setEvents] = useState<ScoutEvent[]>([]);
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("upcoming");
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [registrationEvent, setRegistrationEvent] = useState<ScoutEvent | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ScoutEventInput>(createEmptyEvent);
  const [registeredIds, setRegisteredIds] = useState<string[]>([]);
  const [registrationSearch, setRegistrationSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.events.list(), api.scouts.list()])
      .then(([eventResult, scoutResult]) => { setEvents(eventResult.events); setScouts(scoutResult.scouts); })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Could not load events."))
      .finally(() => setLoading(false));
  }, []);

  const filteredEvents = useMemo(() => {
    const query = search.trim().toLowerCase();
    const currentDate = today();
    return events.filter((event) => {
      const matchesSearch = [event.title, event.eventType, event.location].some((value) => value.toLowerCase().includes(query));
      const matchesDate = dateFilter === "all" || (dateFilter === "upcoming" ? event.endDate >= currentDate : event.endDate < currentDate);
      return matchesSearch && matchesDate;
    });
  }, [dateFilter, events, search]);

  const registrationScouts = useMemo(() => {
    const query = registrationSearch.trim().toLowerCase();
    return scouts.filter((scout) => scout.status === "Active" && [scout.name, scout.unit].some((value) => value.toLowerCase().includes(query)));
  }, [registrationSearch, scouts]);

  const openCreate = () => { setEditingId(null); setForm(createEmptyEvent()); setError(""); setEventModalOpen(true); };
  const openEdit = (event: ScoutEvent) => { setEditingId(event.id); setForm(formFromEvent(event)); setError(""); setEventModalOpen(true); };

  const openRegistrations = async (event: ScoutEvent) => {
    try {
      setSaving(true); setError("");
      const detail = await api.events.get(event.id);
      setRegistrationEvent(detail.event);
      setRegisteredIds(detail.registrations.map((scout) => scout.id));
      setRegistrationSearch("");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load registrations.");
    } finally { setSaving(false); }
  };

  const handleEventSubmit = async (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault();
    try {
      setSaving(true); setError("");
      const result = editingId ? await api.events.update(editingId, form) : await api.events.create(form);
      setEvents((current) => editingId ? current.map((event) => event.id === editingId ? result.event : event) : [...current, result.event].sort((left, right) => left.startDate.localeCompare(right.startDate)));
      setEventModalOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save event.");
    } finally { setSaving(false); }
  };

  const deleteEvent = async (event: ScoutEvent) => {
    if (!window.confirm(`Delete ${event.title}? Its registrations will also be removed.`)) return;
    try { setError(""); await api.events.remove(event.id); setEvents((current) => current.filter((record) => record.id !== event.id)); }
    catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "Could not delete event."); }
  };

  const saveRegistrations = async () => {
    if (!registrationEvent) return;
    try {
      setSaving(true); setError("");
      const result = await api.events.saveRegistrations(registrationEvent.id, registeredIds);
      setEvents((current) => current.map((event) => event.id === result.event.id ? result.event : event));
      setRegistrationEvent(null);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Could not save registrations."); }
    finally { setSaving(false); }
  };

  const toggleRegistration = (scoutId: string) => setRegisteredIds((current) => current.includes(scoutId) ? current.filter((id) => id !== scoutId) : [...current, scoutId]);
  const upcomingCount = events.filter((event) => event.endDate >= today()).length;
  const registrationCount = events.reduce((total, event) => total + event.registrationCount, 0);

  return (
    <div className="page">
      <header className="page-header"><div><span className="eyebrow">Group calendar</span><h1>Events</h1><p>{canManage ? "Plan meetings, adventures, and community projects with the right Scouts registered." : "Explore upcoming meetings, adventures, and community projects."}</p></div>{canManage && <button className="button button-primary" onClick={openCreate}><Icon name="plus" size={18} />Create event</button>}</header>
      {error && !eventModalOpen && !registrationEvent && <div className="form-error page-error">{error}</div>}
      <section className="compact-stats"><div><span>Upcoming events</span><strong>{upcomingCount}</strong></div><div><span>Total registrations</span><strong>{registrationCount}</strong></div><div><span>Active scouts</span><strong>{scouts.filter((scout) => scout.status === "Active").length}</strong></div></section>
      <section className="panel table-panel">
        <div className="toolbar"><label className="search-field"><Icon name="search" size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search events or locations..." /></label><select value={dateFilter} onChange={(event) => setDateFilter(event.target.value as DateFilter)}><option value="upcoming">Upcoming events</option><option value="all">All events</option><option value="past">Past events</option></select></div>
        <div className="table-wrap events-table-wrap"><table><thead><tr><th>Event</th><th>Schedule</th><th>Location</th><th>Registrations</th>{canManage && <th><span className="sr-only">Actions</span></th>}</tr></thead><tbody>{filteredEvents.map((event) => <tr key={event.id}><td><div className="event-title-cell"><span className="event-calendar-icon"><Icon name="events" size={17} /></span><div><strong>{event.title}</strong><span>{event.eventType}</span></div></div></td><td><strong>{formatDate(event.startDate)}{event.endDate !== event.startDate ? ` - ${formatDate(event.endDate)}` : ""}</strong><span className="event-subtle">{timeRange(event)}</span></td><td>{event.location || "Location to be confirmed"}</td><td>{canManage ? <button className="registration-button" onClick={() => openRegistrations(event)}>{event.registrationCount}{event.capacity ? ` / ${event.capacity}` : ""} Scouts</button> : <span>{event.registrationCount}{event.capacity ? ` / ${event.capacity}` : ""} Scouts</span>}</td>{canManage && <td><div className="table-actions"><button aria-label={`Edit ${event.title}`} onClick={() => openEdit(event)}><Icon name="edit" size={17} /></button><button className="danger" aria-label={`Delete ${event.title}`} onClick={() => deleteEvent(event)}><Icon name="trash" size={17} /></button></div></td>}</tr>)}</tbody></table>
          {loading && <div className="empty-state"><p>Loading events...</p></div>}
          {!loading && filteredEvents.length === 0 && <div className="empty-state"><span><Icon name={events.length === 0 ? "events" : "search"} size={25} /></span><h3>{events.length === 0 ? "No events planned yet" : "No events found"}</h3><p>{events.length === 0 ? (canManage ? "Create the first group event to start your calendar." : "There are no group events yet.") : "Try a different search or date filter."}</p>{events.length === 0 && canManage && <button className="button button-primary empty-state-button" onClick={openCreate}><Icon name="plus" size={17} />Create first event</button>}</div>}
        </div>
      </section>
      {eventModalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEventModalOpen(false)}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="event-form-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">{editingId ? "Update schedule" : "New group plan"}</span><h2 id="event-form-title">{editingId ? "Edit event" : "Create event"}</h2></div><button className="round-button" aria-label="Close" onClick={() => setEventModalOpen(false)}><Icon name="x" size={18} /></button></div>{error && <div className="form-error">{error}</div>}<form className="scout-form" onSubmit={handleEventSubmit}><label className="field field-wide"><span>Event name</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Friday weekly meeting" /></label><label className="field"><span>Event type</span><select value={form.eventType} onChange={(event) => setForm({ ...form, eventType: event.target.value as EventType })}>{eventTypes.map((type) => <option key={type}>{type}</option>)}</select></label><label className="field"><span>Capacity</span><input min="1" max="10000" type="number" value={form.capacity ?? ""} onChange={(event) => setForm({ ...form, capacity: event.target.value ? Number(event.target.value) : null })} placeholder="No limit" /></label><label className="field"><span>Start date</span><input required type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value, endDate: form.endDate < event.target.value ? event.target.value : form.endDate })} /></label><label className="field"><span>End date</span><input required min={form.startDate} type="date" value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></label><label className="field"><span>Start time</span><input type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label className="field"><span>End time</span><input type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label><label className="field field-wide"><span>Location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Scout hall or gathering point" /></label><label className="field field-wide"><span>Notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="What should scouts and leaders know?" /></label><div className="form-actions field-wide"><button className="button button-secondary" disabled={saving} type="button" onClick={() => setEventModalOpen(false)}>Cancel</button><button className="button button-primary" disabled={saving} type="submit"><Icon name="check" size={18} />{saving ? "Saving..." : editingId ? "Save changes" : "Create event"}</button></div></form></div></div>}
      {registrationEvent && <div className="modal-backdrop" role="presentation" onMouseDown={() => setRegistrationEvent(null)}><div className="modal registration-modal" role="dialog" aria-modal="true" aria-labelledby="registration-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><span className="eyebrow">Scout registrations</span><h2 id="registration-title">{registrationEvent.title}</h2><p className="registration-caption">{registeredIds.length}{registrationEvent.capacity ? ` of ${registrationEvent.capacity}` : ""} scouts selected</p></div><button className="round-button" aria-label="Close" onClick={() => setRegistrationEvent(null)}><Icon name="x" size={18} /></button></div>{error && <div className="form-error">{error}</div>}<label className="search-field registration-search"><Icon name="search" size={18} /><input value={registrationSearch} onChange={(event) => setRegistrationSearch(event.target.value)} placeholder="Search active scouts..." /></label><div className="registration-list">{registrationScouts.map((scout) => { const selected = registeredIds.includes(scout.id); const capacityReached = registrationEvent.capacity !== null && registeredIds.length >= registrationEvent.capacity; return <label className={`registration-row ${selected ? "selected" : ""}`} key={scout.id}><input checked={selected} disabled={!selected && capacityReached} type="checkbox" onChange={() => toggleRegistration(scout.id)} /><span className="person-avatar">{scout.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><span><strong>{scout.name}</strong><small dir="rtl">{scout.unit}</small></span><Icon name={selected ? "check" : "plus"} size={17} /></label>; })}{registrationScouts.length === 0 && <div className="empty-state"><p>No active scouts match your search.</p></div>}</div><div className="form-actions"><button className="button button-secondary" disabled={saving} type="button" onClick={() => setRegistrationEvent(null)}>Cancel</button><button className="button button-primary" disabled={saving} type="button" onClick={saveRegistrations}><Icon name="check" size={18} />{saving ? "Saving..." : "Save registrations"}</button></div></div></div>}
    </div>
  );
}

export default Events;
