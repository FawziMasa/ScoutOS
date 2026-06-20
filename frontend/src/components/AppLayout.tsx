import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";

function AppLayout() {
    return (
        <div className="app-layout">
            <Sidebar />

            <div className="app-main">
                <Navbar />

                <main className="app-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}

export default AppLayout;