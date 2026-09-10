import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import DashboardGalleryPreview from "../components/gallery/DashboardGalleryPreview";
import Icon from "../components/Icon";
import { api, getStoredUser } from "../lib/api";

function Dashboard() {
    const user = getStoredUser();
    const [counts, setCounts] = useState({ totalScouts: 0, activeScouts: 0, events: 0, attendanceRate: 0 });

    useEffect(() => {
        Promise.all([
            api.scouts.list(),
            api.events.list(),
            api.attendance.sessions.list()
        ]).then(([scoutData, eventData, attendanceData]) => {
            const scouts = scoutData.scouts;
            const events = eventData.events;
            const sessions = attendanceData.sessions;

            const presentTotal = sessions.reduce((sum, s) => sum + s.summary.present + s.summary.late, 0);
            const attendanceTotal = sessions.reduce((sum, s) => sum + s.summary.totalScouts, 0);
            
            setCounts({
                totalScouts: scouts.length,
                activeScouts: scouts.filter((s) => s.status === "Active").length,
                events: events.length,
                attendanceRate: attendanceTotal > 0 ? Math.round((presentTotal / attendanceTotal) * 100) : 0
            });
        }).catch((err) => {
            console.error("DASHBOARD ERROR:", err);
        });
    }, []);

    const metrics = [
        {
            label: "Visible scouts",
            value: String(counts.totalScouts),
            detail: counts.totalScouts === 0 ? "No records yet" : `${counts.activeScouts} active`,
            icon: "users" as const,
            tone: "green",
        },
        {
            label: "Upcoming events",
            value: String(counts.events),
            detail: counts.events === 0 ? "No events scheduled" : "Events scheduled",
            icon: "calendar" as const,
            tone: "gold",
        },
        {
            label: "Attendance rate",
            value: counts.attendanceRate === 0 ? "—" : `${counts.attendanceRate}%`,
            detail: counts.attendanceRate === 0 ? "No attendance recorded" : "Overall rate",
            icon: "attendance" as const,
            tone: "blue",
        },
    ];
    return (
        <div className="page">
            <section className="hero-panel">
                <div>
                    <span className="eyebrow">ScoutOS workspace</span>
                    <h1>Welcome, {user?.fullName || user?.username || "there"}.</h1>
                    <p>Your dashboard only displays information your role is permitted to access.</p>
                </div>
                <Link className="button button-light" to="/scouts">
                    <Icon name="plus" size={18} />
                    Add a scout
                </Link>
            </section>

            <section className="metrics-grid">
                {metrics.map((metric) => (
                    <article className="metric-card" key={metric.label}>
                        <span className={`metric-icon ${metric.tone}`}>
                            <Icon name={metric.icon} size={23} />
                        </span>
                        <div>
                            <p>{metric.label}</p>
                            <strong>{metric.value}</strong>
                            <small>{metric.detail}</small>
                        </div>
                    </article>
                ))}
            </section>

            <section className="dashboard-grid">
                <article className="panel">
                    <h2>Recent Actions</h2>
                    <Link className="button button-secondary" to="/events">Manage Events</Link>
                </article>
                <article className="panel">
                    <h2>Attendance</h2>
                    <Link className="button button-secondary" to="/attendance">Record Attendance</Link>
                    <Link className="button button-secondary" to="/attendance-history" style={{marginTop: '10px'}}>View History</Link>
                </article>
                <DashboardGalleryPreview />
            </section>
        </div>
    );
}
export default Dashboard;
