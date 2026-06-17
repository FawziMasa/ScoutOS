import backgroundImage from "../assets/login-bg.png";
import "./Login.css";

function Login() {
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

                <button className="login-btn">
                    Login
                </button>

                <button className="create-btn">
                    Create Account
                </button>

                <p className="quote">
                    Leave the world a little better than you found it.
                </p>

            </div>
        </div>
    );
}

export default Login;