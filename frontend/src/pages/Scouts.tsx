import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Icon from "../components/Icon";
import {
    api,
    getStoredUser,
    scoutUnits,
    type Scout,
    type ScoutInput,
    type ScoutStatus,
    type ScoutUnit,
} from "../lib/api";

type ScoutWithLegacyJoinedDate = Scout & {
    joined_at?: string;
};

function scoutJoinDate(scout: Scout) {
    const record = scout as ScoutWithLegacyJoinedDate;
    return scout.joinedAt || record.joined_at || "";
}

const units: ScoutUnit[] = [...scoutUnits];

function createEmptyForm(): ScoutInput {
    const user = getStoredUser();
    return {
        name: "",
        age: 10,
        unit: user?.role === "UNIT_LEADER" && user.unit ? user.unit : scoutUnits[0],
        phone: "",
        guardian: "",
        joinedAt: new Date().toISOString().slice(0, 10),
        status: "Active",
    };
}

function Scouts() {
    const user = getStoredUser();
    const unitLocked = user?.role === "UNIT_LEADER";
    const [scouts, setScouts] = useState<Scout[]>([]);
    const [search, setSearch] = useState("");
    const [unitFilter, setUnitFilter] = useState("all");
    const [modalOpen, setModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<ScoutInput>(createEmptyForm);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        api.scouts.list()
            .then(({ scouts: records }) => {
                console.log("RECORDS:", records);
                setScouts(records);
            }).catch((loadError) => { setError(loadError instanceof Error ? loadError.message : "Could not load scouts."); }).finally(() => setLoading(false));
    }, []);
    const filteredScouts = useMemo(() => {
        const query = search.trim().toLowerCase();
        return scouts.filter((scout) => {
            const matchesSearch =
                scout.name.toLowerCase().includes(query) ||
                scout.guardian.toLowerCase().includes(query) ||
                scout.phone.includes(query);
            const matchesUnit = unitFilter === "all" || scout.unit === unitFilter;
            return matchesSearch && matchesUnit;
        });
    }, [scouts, search, unitFilter]);

    const openCreate = () => {
        setEditingId(null);
        setForm(createEmptyForm());
        setError("");
        setModalOpen(true);
    };

    const openEdit = (scout: Scout) => {
        setEditingId(scout.id);
        setForm({
            name: scout.name,
            age: scout.age,
            unit: scout.unit,
            phone: scout.phone,
            guardian: scout.guardian,
            joinedAt: scout.joinedAt,
            status: scout.status,
        });
        setError("");
        setModalOpen(true);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        try {
            setSaving(true);
            setError("");

            if (editingId) {
                const { scout } = await api.scouts.update(editingId, form);
                setScouts((current) =>
                    current.map((record) => record.id === editingId ? scout : record),
                );
            } else {
                const { scout } = await api.scouts.create(form);
                setScouts((current) => [scout, ...current]);
            }

            setModalOpen(false);
        } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Could not save scout.");
        } finally {
            setSaving(false);
        }
    };

    const deleteScout = async (scout: Scout) => {
        if (!window.confirm(`Remove ${scout.name} from ScoutOS?`)) return;

        try {
            setError("");
            await api.scouts.remove(scout.id);
            setScouts((current) => current.filter((record) => record.id !== scout.id));
        } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "Could not remove scout.");
        }
    };

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <span className="eyebrow">People directory</span>
                    <h1>Scouts</h1>
                    <p>
                        {unitLocked && user?.unit
                            ? `You are viewing scouts assigned to ${user.unit}.`
                            : "Manage the scout records your role is permitted to access."}
                    </p>
                </div>
                <button className="button button-primary" onClick={openCreate}>
                    <Icon name="plus" size={18} />
                    Add scout
                </button>
            </header>

            {error && !modalOpen && <div className="form-error page-error">{error}</div>}

            <section className="compact-stats">
                <div>
                    <span>Total members</span>
                    <strong>{scouts.length}</strong>
                </div>
                <div>
                    <span>Active</span>
                    <strong>{scouts.filter((scout) => scout.status === "Active").length}</strong>
                </div>
                <div>
                    <span>Units</span>
                    <strong>{new Set(scouts.map((scout) => scout.unit)).size}</strong>
                </div>
            </section>

            <section className="panel table-panel">
                <div className="toolbar">
                    <label className="search-field">
                        <Icon name="search" size={18} />
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search scouts, guardians, or phone…" />
                    </label>

                    {!unitLocked && (
                        <select dir="rtl" value={unitFilter} onChange={(event) => setUnitFilter(event.target.value)}>
                            <option value="all">كل الوحدات</option>
                            {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                    )}
                </div>

                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Scout</th><th>Unit</th><th>Age</th><th>Contact</th>
                                <th>Joined</th><th>Status</th><th><span className="sr-only">Actions</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredScouts.map((scout) => (
                                <tr key={scout.id}>
                                    <td>
                                        <div className="person-cell">
                                            <span className="person-avatar">{scout.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                                            <div><strong>{scout.name}</strong><span>Guardian: {scout.guardian}</span></div>
                                        </div>
                                    </td>
                                    <td><span className="unit-pill" dir="rtl">{scout.unit}</span></td>
                                    <td>{scout.age}</td>
                                    <td>{scout.phone}</td>
                                    <td>
                                        {new Date(scoutJoinDate(scout)).toLocaleDateString("en-GB", {
                                            day: "numeric",
                                            month: "short",
                                            year: "numeric",
                                        })}
                                    </td>
                                    <td><span className={`status-pill ${scout.status.toLowerCase()}`}>{scout.status}</span></td>
                                    <td>
                                        <div className="table-actions">
                                            <button aria-label={`Edit ${scout.name}`} onClick={() => openEdit(scout)}><Icon name="edit" size={17} /></button>
                                            <button className="danger" aria-label={`Delete ${scout.name}`} onClick={() => deleteScout(scout)}><Icon name="trash" size={17} /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {!loading && filteredScouts.length === 0 && (
                        <div className="empty-state">
                            <span><Icon name={scouts.length === 0 ? "scouts" : "search"} size={25} /></span>
                            <h3>{scouts.length === 0 ? "No scouts added yet" : "No scouts found"}</h3>
                            <p>{scouts.length === 0 ? "Add your first real scout to begin building the directory." : "Try a different name or unit filter."}</p>
                            {scouts.length === 0 && (
                                <button className="button button-primary empty-state-button" onClick={openCreate}><Icon name="plus" size={17} />Add first scout</button>
                            )}
                        </div>
                    )}

                    {loading && <div className="empty-state"><p>Loading scout records…</p></div>}
                </div>
            </section>

            {modalOpen && (
                <div className="modal-backdrop" role="presentation" onMouseDown={() => setModalOpen(false)}>
                    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="scout-form-title" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="modal-heading">
                            <div>
                                <span className="eyebrow">{editingId ? "Update profile" : "New member"}</span>
                                <h2 id="scout-form-title">{editingId ? "Edit scout" : "Add a scout"}</h2>
                            </div>
                            <button className="round-button" aria-label="Close" onClick={() => setModalOpen(false)}><Icon name="x" size={18} /></button>
                        </div>

                        {error && <div className="form-error">{error}</div>}

                        <form className="scout-form" onSubmit={handleSubmit}>
                            <label className="field field-wide">
                                <span>Full name</span>
                                <input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Scout's full name" />
                            </label>
                            <label className="field">
                                <span>Age</span>
                                <input required min="5" max="30" type="number" value={form.age} onChange={(event) => setForm({ ...form, age: Number(event.target.value) })} />
                            </label>
                            <label className="field">
                                <span>Unit</span>
                                <select disabled={unitLocked} dir="rtl" value={form.unit} onChange={(event) => setForm({ ...form, unit: event.target.value as ScoutUnit })}>
                                    {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                                </select>
                            </label>
                            <label className="field">
                                <span>Phone number</span>
                                <input required value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} placeholder="07X XXX XXXX" />
                            </label>
                            <label className="field">
                                <span>Guardian</span>
                                <input required value={form.guardian} onChange={(event) => setForm({ ...form, guardian: event.target.value })} placeholder="Guardian's name" />
                            </label>
                            <label className="field">
                                <span>Join date</span>
                                <input required type="date" value={form.joinedAt} onChange={(event) => setForm({ ...form, joinedAt: event.target.value })} />
                            </label>
                            <label className="field">
                                <span>Status</span>
                                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as ScoutStatus })}>
                                    <option>Active</option><option>Inactive</option>
                                </select>
                            </label>

                            <div className="form-actions field-wide">
                                <button className="button button-secondary" disabled={saving} type="button" onClick={() => setModalOpen(false)}>Cancel</button>
                                <button className="button button-primary" disabled={saving} type="submit">
                                    <Icon name="check" size={18} />
                                    {saving ? "Saving…" : editingId ? "Save changes" : "Add scout"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Scouts;
