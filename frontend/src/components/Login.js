import { useState } from "react";
import { Helmet } from "react-helmet-async";
import "./classes/Login.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("http://localhost:8080/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage("Login successful ✅");

        // store token (important for POS system)
        localStorage.setItem("token", data.token);
      } else {
        setMessage(data.message || "Login failed ❌");
      }
    } catch (error) {
      setMessage("Server error");
    }

    setLoading(false);
  };

 return (
  <div className="login-container">
    <Helmet>
        <title>POS System - Login</title>
        <meta name="description" content="Real-time retail and wholesale billing application terminal." />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      </Helmet>
    <h2>Login</h2>

    {/* MESSAGE BOX (NEW) */}
    {message && (
      <div
        className={`message-box ${
          message.includes("successful") ? "success" : "error"
        }`}
      >
        {message}
      </div>
    )}

    <form onSubmit={handleLogin}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        className="login-button"
        type="submit"
        disabled={loading}
      >
        {loading ? "Logging in..." : "Login"}
      </button>
    </form>
  </div>
);
}

export default Login;