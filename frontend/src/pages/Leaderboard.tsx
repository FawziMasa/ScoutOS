import { useEffect, useState } from "react";
import Icon from "../components/Icon";
import { api, type LeaderboardEntry } from "../lib/api";

function Leaderboard() {
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        api.points.leaderboard()
            .then(({ leaderboard }) => {
                setEntries(leaderboard);
            }).catch((loadError) => {
                setError(loadError instanceof Error ? loadError.message : "Could not load leaderboard.");
            }).finally(() => setLoading(false));
    }, []);

    return (
        <div className="page">
            <header className="page-header">
                <div>
                    <span className="eyebrow">Points system</span>
                    <h1>Leaderboard</h1>
                    <p>Scouts ranked by total points.</p>
                </div>
            </header>

            {error && <div className="form-error page-error">{error}</div>}

            <section className="panel table-panel">
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Rank</th><th>Scout</th><th>Unit</th><th>Points</th>
                            </tr>
                        </thead>
                        <tbody>
                            {entries.map((entry, index) => (
                                <tr key={entry.scoutId}>
                                    <td>{index + 1}</td>
                                    <td>
                                        <div className="person-cell">
                                            <span className="person-avatar">{entry.name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</span>
                                            <strong>{entry.name}</strong>
                                        </div>
                                    </td>
                                    <td><span className="unit-pill" dir="rtl">{entry.unit}</span></td>
                                    <td><strong>{entry.totalPoints}</strong></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {!loading && entries.length === 0 && (
                        <div className="empty-state">
                            <Icon name="shield" size={25} />
                            <h3>No points recorded yet</h3>
                        </div>
                    )}

                    {loading && <div className="empty-state"><p>Loading leaderboard…</p></div>}
                </div>
            </section>
        </div>
    );
}

export default Leaderboard;
