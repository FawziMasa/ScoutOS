import backgroundImage from "../assets/login-bg.png";
import "./Login.css";
import { Link } from "react-router-dom";

function Login() {
    const handleLogin = () => {
        sessionStorage.setItem("loggedIn", "true");
        window.location.href = "/dashboard";
    };

    return (
        <div
            className="login-page"
            style={{
                backgroundImage: `url(${backgroundImage})`,
            }}
        >
            <div className="login-card">
                <h1>SweifiehOS</h1>

                <h2>Welcome Back</h2>

                <input
                    type="text"
                    placeholder="Username"
                />

                <input
                    type="password"
                    placeholder="Password"
                />

                <button
                    className="login-btn"
                    onClick={handleLogin}
                >
                    Login
                </button>

                <br /><br />

                <Link to="/register">
                    Create Account
                </Link>

                <br /><br />

                <Link to="/forgot-password">
                    Forgot Password?
                </Link>
            </div>
        </div>
    );
}

export default Login;