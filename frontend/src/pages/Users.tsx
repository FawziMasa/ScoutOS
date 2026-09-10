import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { api, type AuthUser, scoutUnits, type ScoutUnit, type UserInput, type UserRole } from "../lib/api";
import Icon from "../components/Icon";

type UserForm = Omit<UserInput, "unit"> & {
  password: string;
  unit: ScoutUnit;
};

function createEmptyUserForm(): UserForm {
  return {
    fullName: "",
    username: "",
    email: "",
    password: "",
    role: "UNIT_LEADER",
    unit: scoutUnits[0],
  };
}

function Users() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(createEmptyUserForm);

  const fetchUsers = async () => {
    const data = await api.users.list();
    setUsers(data.users);
  };

  useEffect(() => {
    api.users.list().then((data) => setUsers(data.users));
  }, []);

  const openEdit = (user: AuthUser) => {
    setEditingId(user.id);
    setForm({ fullName: user.fullName, username: user.username, email: "", password: "", role: user.role, unit: user.unit || scoutUnits[0] });
    setModalOpen(true);
  };

  const deleteUser = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete ${name}?`)) return;
    await api.users.remove(id);
    fetchUsers();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.users.update(editingId, form);
      } else {
        await api.users.create(form);
      }
      alert(`Leader ${editingId ? 'updated' : 'created'} successfully!`);
      setModalOpen(false);
      setEditingId(null);
      setForm(createEmptyUserForm());
      fetchUsers();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save user.");
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Manage Leaders</h1>
        <button className="button button-primary" onClick={() => { setEditingId(null); setModalOpen(true); }}>
            <Icon name="plus" size={18} />
            Add Leader
        </button>
      </header>
      <div className="panel table-panel">
        <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Unit</th><th>Actions</th></tr></thead>
            <tbody>
                {users.map(user => <tr key={user.id}>
                    <td>{user.fullName}</td>
                    <td>{user.username}</td>
                    <td>{user.role}</td>
                    <td>{user.unit || "-"}</td>
                    <td>
                        <button className="button-icon" onClick={() => openEdit(user)}><Icon name="edit" size={16}/></button>
                        <button className="button-icon danger" onClick={() => deleteUser(user.id, user.fullName)}><Icon name="trash" size={16}/></button>
                    </td>
                </tr>)}
            </tbody>
        </table>
      </div>
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-heading">
                    <h2>{editingId ? "Edit Leader" : "Add Leader"}</h2>
                    <button className="round-button" onClick={() => setModalOpen(false)}><Icon name="x" size={18} /></button>
                </div>
                <form className="scout-form" onSubmit={handleSubmit}>
                    <label className="field field-wide"><span>Full Name</span>
                        <input required placeholder="Full Name" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} />
                    </label>
                    <label className="field field-wide"><span>Username</span>
                        <input required placeholder="Username" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                    </label>
                    <label className="field field-wide"><span>Email Address</span>
                        <input required type="email" placeholder="Email Address" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                    </label>
                    {!editingId && <label className="field field-wide"><span>Password</span>
                        <input required type="password" placeholder="Password" onChange={e => setForm({...form, password: e.target.value})} />
                    </label>}
                    <label className="field field-wide"><span>Role</span>
                        <select value={form.role} onChange={e => setForm({...form, role: e.target.value as UserRole})}>
                            <option value="UNIT_LEADER">Unit Leader</option>
                            <option value="GROUP_LEADER">Group Leader</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </label>
                    {form.role === "UNIT_LEADER" && (
                        <label className="field field-wide"><span>Unit</span>
                            <select value={form.unit} onChange={e => setForm({...form, unit: e.target.value as ScoutUnit})}>
                                {scoutUnits.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                            </select>
                        </label>
                    )}
                    <div className="form-actions field-wide">
                        <button type="button" className="button button-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                        <button type="submit" className="button button-primary">Save Leader</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}

export default Users;
