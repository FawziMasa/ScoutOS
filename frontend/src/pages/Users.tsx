import { useEffect, useState } from "react";
import { api, type AuthUser, scoutUnits, type UserRole } from "../lib/api";
import Icon from "../components/Icon";

function Users() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ fullName: "", username: "", email: "", password: "", role: "UNIT_LEADER" as UserRole, unit: scoutUnits[0] });

  useEffect(() => {
    api.users.list().then(data => {
        setUsers(data.users);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.users.create(form);
      alert("Leader account created successfully!");
      setModalOpen(false);
      setForm({ fullName: "", username: "", email: "", password: "", role: "UNIT_LEADER", unit: scoutUnits[0] });
      const data = await api.users.list();
      setUsers(data.users);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create user.");
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <h1>Manage Leaders</h1>
        <button className="button button-primary" onClick={() => setModalOpen(true)}>
            <Icon name="plus" size={18} />
            Add Leader
        </button>
      </header>
      <div className="panel table-panel">
        <table>
            <thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Unit</th></tr></thead>
            <tbody>
                {users.map(user => <tr key={user.id}><td>{user.fullName}</td><td>{user.username}</td><td>{user.role}</td><td>{user.unit}</td></tr>)}
            </tbody>
        </table>
      </div>
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-heading">
                    <h2>Add Leader</h2>
                    <button className="round-button" onClick={() => setModalOpen(false)}><Icon name="x" size={18} /></button>
                </div>
                <form className="scout-form" onSubmit={handleSubmit}>
                    <label className="field field-wide"><span>Full Name</span>
                        <input required placeholder="Full Name" onChange={e => setForm({...form, fullName: e.target.value})} />
                    </label>
                    <label className="field field-wide"><span>Username</span>
                        <input required placeholder="Username" onChange={e => setForm({...form, username: e.target.value})} />
                    </label>
                    <label className="field field-wide"><span>Email</span>
                        <input required type="email" placeholder="Email" onChange={e => setForm({...form, email: e.target.value})} />
                    </label>
                    <label className="field field-wide"><span>Password</span>
                        <input required type="password" placeholder="Password" onChange={e => setForm({...form, password: e.target.value})} />
                    </label>
                    <label className="field field-wide"><span>Role</span>
                        <select onChange={e => setForm({...form, role: e.target.value as UserRole})}>
                            <option value="UNIT_LEADER">Unit Leader</option>
                            <option value="GROUP_LEADER">Group Leader</option>
                            <option value="ADMIN">Admin</option>
                        </select>
                    </label>
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
