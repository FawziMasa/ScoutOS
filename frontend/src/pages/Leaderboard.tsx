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
                            {entries && entries.length > 0 ? (
                                entries.map((entry, index) => (
                                    <tr key={entry.scoutId || index}>
                                        <td>{index + 1}</td>
                                        <td>
                                            <div className="person-cell">
                                                <span className="person-avatar">{entry.name?.split(" ").map((part) => part[0]).slice(0, 2).join("") || "??"}</span>
                                                <strong>{entry.name || "Unknown Scout"}</strong>
                                            </div>
                                        </td>
                                        <td><span className="unit-pill" dir="rtl">{entry.unit || "-"}</span></td>
                                        <td><strong>{entry.totalPoints ?? 0}</strong></td>
                                    </tr>
                                ))
                            ) : (
                                !loading && (
                                    <tr>
                                        <td colSpan={4} style={{textAlign: 'center', padding: '20px'}}>No leaderboard data available.</td>
                                    </tr>
                                )
                            )}
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
