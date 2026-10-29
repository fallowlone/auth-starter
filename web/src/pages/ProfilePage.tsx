import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api, type Profile } from "../api";

export function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.profile().then(setProfile, (err) => {
      if (err instanceof ApiError && err.status === 401) navigate("/login", { replace: true });
      else setError("Could not load your profile. Try again later.");
    });
  }, [navigate]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      setProfile(await api.updateProfile({ name: String(form.get("name")), bio: String(form.get("bio")) }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await api.logout().catch(() => undefined);
    navigate("/login");
  }

  if (!profile) {
    return (
      <section className="card" aria-busy={!error}>
        {error ? <p className="error" role="alert">{error}</p> : <p className="muted">Loading…</p>}
      </section>
    );
  }

  return (
    <section className="card" aria-labelledby="profile-title">
      <h1 id="profile-title">Your profile</h1>
      <p className="muted">
        {profile.email} · member since {new Date(profile.createdAt).toLocaleDateString()}
      </p>
      <form onSubmit={onSubmit}>
        <label>
          Name
          <input name="name" defaultValue={profile.name} maxLength={100} />
        </label>
        <label>
          Bio
          <textarea name="bio" defaultValue={profile.bio} maxLength={500} rows={4} />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        {saved && <p className="success" role="status">Saved</p>}
        <button type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </form>
      <button type="button" className="secondary" onClick={logout}>
        Log out
      </button>
    </section>
  );
}
