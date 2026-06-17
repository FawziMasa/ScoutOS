function ForgotPassword() {
    return (
        <div style={{ padding: "40px" }}>
            <h1>Reset Password</h1>

            <input
                type="email"
                placeholder="Enter your email"
            />

            <br /><br />

            <button>
                Send Reset Link
            </button>
        </div>
    );
}

export default ForgotPassword;