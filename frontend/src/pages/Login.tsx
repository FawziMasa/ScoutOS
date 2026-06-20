import { useState } from "react";
import backgroundImage from "../assets/login-bg.png";
import "./Login.css";
import { Link } from "react-router-dom";

function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);

    const handleLogin = () => {
        if (!username.trim()) {
            alert("Username is required.");
            return;
        }

        if (!password.trim()) {
            alert("Password is required.");
            return;
        }

        if (rememberMe) {
            localStorage.setItem("loggedIn", "true");
        } else {
            sessionStorage.setItem("loggedIn", "true");
        }

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
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                />

                <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                />

                <div style={{ marginBottom: "15px" }}>
                    <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) =>
                            setRememberMe(e.target.checked)
                        }
                    />
                    {" "}Remember Me
                </div>

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