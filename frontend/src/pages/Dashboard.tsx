function Dashboard() {
    return (
        <div style={{ padding: "40px" }}>
            <h1>SweifiehOS Dashboard</h1>

            <p>Welcome to the system.</p>

            <button
                onClick={() => {
                    sessionStorage.removeItem("loggedIn");
                    window.location.href = "/";
                }}
            >
                Logout
            </button>
        </div>
    );
}

export default Dashboard;