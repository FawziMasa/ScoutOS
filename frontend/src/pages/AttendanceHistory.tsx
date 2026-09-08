import { useEffect, useState } from "react";
import { api, type AttendanceSession } from "../lib/api";

function AttendanceHistory() {
    const [sessions, setSessions] = useState<AttendanceSession[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.attendance.sessions.list()
            .then(({ sessions }) => setSessions(sessions))
            .finally(() => setLoading(false));
    }, []);

    return (
        <div className="page">
            <header className="page-header">
                <h1>Attendance History</h1>
            </header>

            <section className="panel">
                {loading ? <p>Loading history...</p> : (
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Meeting Name</th>
                                <th>Type</th>
                                <th>Attendance Rate</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map(session => (
                                <tr key={session.id}>
                                    <td>{session.meetingDate}</td>
                                    <td>{session.meetingName}</td>
                                    <td>{session.meetingType}</td>
                                    <td>{session.summary.attendanceRate}%</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </section>
        </div>
    );
}
export default AttendanceHistory;
