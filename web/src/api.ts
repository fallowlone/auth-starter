export interface Profile {
  id: string;
  email: string;
  name: string;
  bio: string;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init.headers },
  });
  // Access token expired: refresh once, then replay the request.
  if (res.status === 401 && !retried && !path.startsWith("/auth/")) {
    const refreshed = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
    if (refreshed.ok) return call<T>(path, init, true);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

export const api = {
  signup: (d: { email: string; password: string; name: string }) => call("/auth/signup", json("POST", d)),
  login: (d: { email: string; password: string }) => call("/auth/login", json("POST", d)),
  logout: () => call("/auth/logout", { method: "POST" }),
  providers: () => call<{ google: boolean }>("/auth/providers"),
  profile: () => call<Profile>("/profile"),
  updateProfile: (d: { name: string; bio: string }) => call<Profile>("/profile", json("PATCH", d)),
};
