import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api";

interface Props {
  mode: "login" | "signup";
}

export function AuthPage({ mode }: Props) {
  const isSignup = mode === "signup";
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState(params.get("error") === "oauth" ? "Google sign-in failed" : "");
  const [busy, setBusy] = useState(false);
  const [google, setGoogle] = useState(false);

  useEffect(() => {
    api.providers().then((p) => setGoogle(p.google), () => setGoogle(false));
  }, []);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setBusy(true);
    setError("");
    try {
      if (isSignup) await api.signup({ email, password, name: String(form.get("name") ?? "") });
      else await api.login({ email, password });
      navigate("/profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card" aria-labelledby="auth-title">
      <h1 id="auth-title">{isSignup ? "Create your account" : "Welcome back"}</h1>
      <form onSubmit={onSubmit} noValidate={false}>
        {isSignup && (
          <label>
            Name
            <input name="name" autoComplete="name" maxLength={100} />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={8}
            required
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          {busy ? "Please wait…" : isSignup ? "Sign up" : "Log in"}
        </button>
      </form>
      {google && (
        <a className="button secondary" href="/api/auth/google">
          Continue with Google
        </a>
      )}
      <p className="muted">
        {isSignup ? "Already have an account? " : "New here? "}
        <Link to={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create an account"}</Link>
      </p>
    </section>
  );
}
