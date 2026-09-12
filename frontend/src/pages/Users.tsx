import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import Icon from "../components/Icon";
import {
  api,
  type AccountState,
  type AuthUser,
  type Scout,
  type UnitRecord,
  type UserInput,
  type UserRole,
} from "../lib/api";

type AccountForm = UserInput & { password: string };

const accountStateLabels: Record<AccountState, string> = {
  ACTIVE: "Active",
  INVITED: "Invited",
  EXPIRED: "Expired",
  INVITATION_FAILED: "Invite failed",
  INACTIVE: "Inactive",
};

function invitationActionLabel(account: AuthUser) {
  return account.accountState === "INACTIVE" || account.accountState === "INVITATION_FAILED"
    ? "Invite"
    : "Resend";
}

function emptyAccountForm(): AccountForm {
  return {
    fullName: "",
    username: "",
    email: "",
    password: "",
    role: "UNIT_LEADER",
    unit: null,
    assignedUnitIds: [],
    scoutId: null,
    active: true,
  };
}

function assignmentLabel(user: AuthUser, scouts: Scout[]) {
  if (user.role === "ADMIN" || user.role === "GROUP_LEADER") return "All units";
  if (user.role === "SCOUT") {
    return scouts.find((scout) => scout.id === user.scoutId)?.name || "Scout link unavailable";
  }
  return user.assignedUnits.map((unit) => unit.name).join(", ") || "No units";
}

function Users() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [unitRecords, setUnitRecords] = useState<UnitRecord[]>([]);
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyAccountForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [invitationBusyId, setInvitationBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const activeScouts = useMemo(
    () => scouts.filter((scout) => scout.status === "Active"),
    [scouts],
  );

  const fetchUsers = async () => {
    const data = await api.users.list();
    setUsers(data.users);
  };

  useEffect(() => {
    Promise.all([api.users.list(), api.units(), api.scouts.list()])
      .then(([accountData, unitData, scoutData]) => {
        setUsers(accountData.users);
        setUnitRecords(unitData.unitRecords);
        setScouts(scoutData.scouts);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : "Could not load account administration.");
      })
      .finally(() => setLoading(false));
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({
      ...emptyAccountForm(),
      assignedUnitIds: unitRecords[0] ? [unitRecords[0].id] : [],
    });
    setError("");
    setNotice("");
    setModalOpen(true);
  };

  const openEdit = (user: AuthUser) => {
    setEditingId(user.id);
    setForm({
      fullName: user.fullName,
      username: user.username,
      email: user.email,
      password: "",
      role: user.role,
      unit: null,
      assignedUnitIds: user.assignedUnits.map((unit) => unit.id),
      scoutId: user.scoutId,
      active: user.active,
    });
    setError("");
    setNotice("");
    setModalOpen(true);
  };

  const setRole = (role: UserRole) => {
    setForm((current) => ({
      ...current,
      role,
      active: role === "SCOUT"
        ? Boolean(editingId && current.role === "SCOUT" && current.active)
        : current.active,
      assignedUnitIds:
        role === "UNIT_LEADER"
          ? current.assignedUnitIds.length
            ? current.assignedUnitIds
            : unitRecords[0]
              ? [unitRecords[0].id]
              : []
          : [],
      scoutId: role === "SCOUT" ? current.scoutId : null,
    }));
  };

  const toggleUnit = (unitId: number) => {
    setForm((current) => ({
      ...current,
      assignedUnitIds: current.assignedUnitIds.includes(unitId)
        ? current.assignedUnitIds.filter((id) => id !== unitId)
        : [...current.assignedUnitIds, unitId],
    }));
  };

  const deactivateUser = async (account: AuthUser) => {
    if (!window.confirm("Deactivate " + account.fullName + "? Existing sessions will stop working, while historical records stay intact.")) return;
    try {
      setNotice("");
      await api.users.remove(account.id);
      await fetchUsers();
      setNotice(`${account.fullName} was deactivated.`);
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Could not deactivate this account.");
    }
  };

  const sendInvitation = async (account: AuthUser) => {
    try {
      setInvitationBusyId(account.id);
      setError("");
      setNotice("");
      await api.users.sendInvitation(account.id);
      await fetchUsers();
      setNotice(`Invitation sent to ${account.fullName}.`);
    } catch (invitationError) {
      await fetchUsers();
      setError(invitationError instanceof Error ? invitationError.message : "Could not send this invitation.");
    } finally {
      setInvitationBusyId(null);
    }
  };

  const revokeInvitation = async (account: AuthUser) => {
    if (!window.confirm(`Revoke the pending invitation for ${account.fullName}?`)) return;
    try {
      setInvitationBusyId(account.id);
      setError("");
      setNotice("");
      await api.users.revokeInvitation(account.id);
      await fetchUsers();
      setNotice(`Invitation revoked for ${account.fullName}.`);
    } catch (invitationError) {
      setError(invitationError instanceof Error ? invitationError.message : "Could not revoke this invitation.");
    } finally {
      setInvitationBusyId(null);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      if (editingId) {
        await api.users.update(editingId, form);
      } else {
        const { user: created } = await api.users.create(form);
        if (form.role === "SCOUT") {
          try {
            await api.users.sendInvitation(created.id);
          } catch (invitationError) {
            await fetchUsers();
            setModalOpen(false);
            setError(`Scout account created, but ${invitationError instanceof Error ? invitationError.message : "the invitation could not be sent."}`);
            return;
          }
        }
      }
      await fetchUsers();
      setModalOpen(false);
      setEditingId(null);
      setForm(emptyAccountForm());
      setNotice(form.role === "SCOUT" && !editingId ? "Scout account created and invitation sent." : "Account saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div><span className="eyebrow">Administration</span><h1>Manage Accounts</h1><p>Create leaders and securely invite Scouts to choose their own passwords.</p></div>
        <button className="button button-primary" onClick={openCreate} type="button"><Icon name="plus" size={18} />Add account</button>
      </header>
      {error && !modalOpen && <div className="form-error page-error">{error}</div>}
      {notice && !modalOpen && <div className="page-success">{notice}</div>}
      <div className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Access / Link</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>{users.map((account) => {
              const stateClass = account.accountState.toLowerCase().replaceAll("_", "-");
              const invitationBusy = invitationBusyId === account.id;
              return (
                <tr key={account.id}>
                  <td><div className="person-cell"><span className="person-avatar">{account.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span><div><strong>{account.fullName}</strong><span>{account.email}</span></div></div></td>
                  <td>{account.username}</td>
                  <td>{account.role.replaceAll("_", " ")}</td>
                  <td><span className="account-assignment" dir="auto">{assignmentLabel(account, scouts)}</span></td>
                  <td><div className="account-status-cell"><span className={`status-pill ${stateClass}`}>{accountStateLabels[account.accountState]}</span>{account.accountState === "INVITED" && account.invitationExpiresAt && <small>Expires {new Date(account.invitationExpiresAt).toLocaleString()}</small>}</div></td>
                  <td>
                    <div className="table-actions">
                      <button aria-label={"Edit " + account.fullName} disabled={invitationBusy} onClick={() => openEdit(account)} type="button"><Icon name="edit" size={16} /></button>
                      {account.role === "SCOUT" && !account.active && <button className="account-invite-action" disabled={invitationBusy} onClick={() => sendInvitation(account)} type="button">{invitationBusy ? "Working…" : invitationActionLabel(account)}</button>}
                      {account.role === "SCOUT" && account.accountState === "INVITED" && <button className="danger" aria-label={"Revoke invitation for " + account.fullName} disabled={invitationBusy} onClick={() => revokeInvitation(account)} title="Revoke invitation" type="button"><Icon name="x" size={16} /></button>}
                      {account.active && <button className="danger" aria-label={"Deactivate " + account.fullName} disabled={invitationBusy} onClick={() => deactivateUser(account)} type="button"><Icon name="x" size={16} /></button>}
                    </div>
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
          {!loading && users.length === 0 && <div className="empty-state"><p>No accounts found.</p></div>}
          {loading && <div className="empty-state"><p>Loading accounts…</p></div>}
        </div>
      </div>

      {modalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => !saving && setModalOpen(false)}>
          <div className="modal account-modal" role="dialog" aria-modal="true" aria-labelledby="account-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading"><div><span className="eyebrow">{editingId ? "Update access" : "New login"}</span><h2 id="account-title">{editingId ? "Edit Account" : "Add Account"}</h2></div><button className="round-button" disabled={saving} onClick={() => setModalOpen(false)} type="button"><Icon name="x" size={18} /></button></div>
            {error && <div className="form-error">{error}</div>}
            <form className="scout-form" onSubmit={handleSubmit}>
              <label className="field"><span>Full name</span><input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
              <label className="field"><span>Username</span><input required value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} /></label>
              <label className="field field-wide"><span>Email address</span><input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label className="field"><span>Role</span><select value={form.role} onChange={(event) => setRole(event.target.value as UserRole)}><option value="UNIT_LEADER">Unit Leader</option><option value="GROUP_LEADER">Group Leader</option><option value="ADMIN">Admin</option><option value="SCOUT">Scout</option></select></label>
              {form.role !== "SCOUT" && <label className="field"><span>{editingId ? "New password (optional)" : "Initial password"}</span><input minLength={8} required={!editingId} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>}

              {form.role === "UNIT_LEADER" && <fieldset className="field field-wide unit-assignment-field"><legend>Assigned units</legend><p>Select every unit this leader may manage.</p><div className="unit-checkbox-grid">{unitRecords.map((unit) => <label key={unit.id} className={form.assignedUnitIds.includes(unit.id) ? "selected" : ""}><input checked={form.assignedUnitIds.includes(unit.id)} onChange={() => toggleUnit(unit.id)} type="checkbox" /><span dir="rtl">{unit.name}</span></label>)}</div></fieldset>}
              {form.role === "SCOUT" && <label className="field field-wide"><span>Linked Scout</span><select required value={form.scoutId || ""} onChange={(event) => setForm({ ...form, scoutId: event.target.value || null })}><option value="">Select an existing active Scout</option>{activeScouts.map((scout) => <option key={scout.id} value={scout.id}>{scout.name} — {scout.unit}</option>)}</select></label>}
              {form.role === "SCOUT" && <div className="account-invitation-note field-wide"><Icon name="shield" size={19} /><span><strong>The Scout chooses the password</strong><small>{editingId ? "Use Invite or Resend from the account table when this account is inactive." : "This account starts inactive. ScoutOS emails a 24-hour, one-time activation link after saving."}</small></span></div>}
              {form.role !== "SCOUT" && <label className="account-active-toggle field-wide"><input checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} type="checkbox" /><span><strong>Active account</strong><small>Inactive accounts cannot sign in and existing sessions are invalidated.</small></span></label>}
              <div className="form-actions field-wide"><button className="button button-secondary" disabled={saving} onClick={() => setModalOpen(false)} type="button">Cancel</button><button className="button button-primary" disabled={saving} type="submit"><Icon name="check" size={18} />{saving ? "Saving…" : "Save account"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Users;
