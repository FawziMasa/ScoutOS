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
    await api.users.create(form);
    setModalOpen(false);
    const data = await api.users.list();
    setUsers(data.users);
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
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Unit</th></tr></thead>
            <tbody>
                {users.map(user => <tr key={user.id}><td>{user.fullName}</td><td>{user.username}</td><td>{user.role}</td><td>{user.unit}</td></tr>)}
            </tbody>
        </table>
      </div>
      {modalOpen && (
        <div className="modal-backdrop">
            <div className="modal">
                <h2>Add Leader</h2>
                <form onSubmit={handleSubmit}>
                    <input placeholder="Full Name" onChange={e => setForm({...form, fullName: e.target.value})} />
                    <input placeholder="Username" onChange={e => setForm({...form, username: e.target.value})} />
                    <input type="email" placeholder="Email" onChange={e => setForm({...form, email: e.target.value})} />
                    <input type="password" placeholder="Password" onChange={e => setForm({...form, password: e.target.value})} />
                    <select onChange={e => setForm({...form, role: e.target.value as UserRole})}>
                        <option value="UNIT_LEADER">Unit Leader</option>
                        <option value="GROUP_LEADER">Group Leader</option>
                        <option value="ADMIN">Admin</option>
                    </select>
                    <button type="submit" className="button button-primary">Save</button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}

export default Users;
