import { useEffect } from "react";

function Dashboard() {
    useEffect(() => {
        const loggedIn =
            sessionStorage.getItem("loggedIn") ||
            localStorage.getItem("loggedIn");

        if (!loggedIn) {
            window.location.href = "/";
        }
    }, []);

    const handleLogout = () => {
        sessionStorage.removeItem("loggedIn");
        localStorage.removeItem("loggedIn");
        window.location.href = "/";
    };

    return (
        <div style={{ padding: "40px" }}>
            <h1>SweifiehOS Dashboard</h1>

            <p>Welcome to the system.</p>

            <button onClick={handleLogout}>
                Logout
            </button>
        </div>
    );
}

export default Dashboard;