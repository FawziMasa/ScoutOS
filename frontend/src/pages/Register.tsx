function Register() {
    return (
        <div style={{ padding: "40px" }}>
            <h1>Create Account</h1>

            <input placeholder="Full Name" />
            <br /><br />

            <input placeholder="Username" />
            <br /><br />

            <input placeholder="Email" />
            <br /><br />

            <input type="password" placeholder="Password" />
            <br /><br />

            <input type="password" placeholder="Confirm Password" />
            <br /><br />

            <button>Create Account</button>
        </div>
    );
}

export default Register;