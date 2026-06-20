import { useState } from "react";

function Register() {
    const [fullName, setFullName] = useState("");
    const [username, setUsername] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const handleRegister = () => {
        if (
            !fullName ||
            !username ||
            !email ||
            !password ||
            !confirmPassword
        ) {
            alert("Please fill all fields.");
            return;
        }

        if (!email.includes("@")) {
            alert("Invalid email.");
            return;
        }

        if (password.length < 8) {
            alert("Password must be at least 8 characters.");
            return;
        }

        if (password !== confirmPassword) {
            alert("Passwords do not match.");
            return;
        }

        alert("Account created successfully.");

        window.location.href = "/";
    };

    return (
        <div style={{ padding: "40px" }}>
            <h1>Create Account</h1>

            <input
                placeholder="Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
            />
            <br /><br />

            <input
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            <br /><br />

            <input
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <br /><br />

            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <br /><br />

            <input
                type="password"
                placeholder="Confirm Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <br /><br />

            <button onClick={handleRegister}>
                Create Account
            </button>
        </div>
    );
}

export default Register;