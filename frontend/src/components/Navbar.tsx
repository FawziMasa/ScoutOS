import { useNavigate } from "react-router-dom";

function Navbar() {
    const navigate = useNavigate();

    const handleLogout = () => {
        sessionStorage.removeItem("loggedIn");
        localStorage.removeItem("loggedIn");
        navigate("/");
    };

    return (
        <header className="navbar">
            <span>Al-Sweifieh Scout Group</span>

            <button className="logout-button" onClick={handleLogout}>
                Log out
            </button>
        </header>
    );
}

export default Navbar;