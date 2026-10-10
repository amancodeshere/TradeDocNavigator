import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { request, errorMessage, type User } from "../lib/api";
export default function AuthForm({ register = false }: { register?: boolean }) {
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { user, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (user) return <Navigate to="/dashboard" replace />;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await request<{ user: User }>(
        `/v1/admin/${register ? "register" : "login"}`,
        {
          method: "POST",
          body: JSON.stringify({ companyName, email, password }),
        },
      );
      signIn(data.user);
      const from = location.state?.from;
      navigate(
        typeof from === "string" &&
          from.startsWith("/") &&
          !from.startsWith("//")
          ? from
          : "/dashboard",
        { replace: true },
      );
    } catch (error) {
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="auth-page">
      <Link to="/" className="brand">
        <img src="/logo2.png" alt="TradeDocs Navigator home" />
      </Link>
      <main className="auth-panel">
        <h1>{register ? "Create your account" : "Welcome back"}</h1>
        <p>
          {register
            ? "Set up a workspace for your trade documents."
            : "Sign in to your trade workspace."}
        </p>
        <form onSubmit={(event) => void submit(event)}>
          {register && (
            <label htmlFor="company">
              Company name
              <input
                id="company"
                autoComplete="organization"
                required
                minLength={3}
                maxLength={200}
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
              />
            </label>
          )}
          <label htmlFor="email">
            Email
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label htmlFor="password">
            Password
            <input
              id="password"
              type="password"
              autoComplete={register ? "new-password" : "current-password"}
              required
              minLength={register ? 8 : 1}
              maxLength={72}
              aria-describedby={register ? "password-hint" : undefined}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {register && (
            <p className="hint" id="password-hint">
              At least 8 characters, including a letter and a number.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={busy}>
            {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
          </button>
        </form>
        <p className="auth-switch">
          {register
            ? "Already have an account?"
            : "New to TradeDocs Navigator?"}{" "}
          <Link to={register ? "/login" : "/register"}>
            {register ? "Sign in" : "Create an account"}
          </Link>
        </p>
      </main>
    </div>
  );
}
