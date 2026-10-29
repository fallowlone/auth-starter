import { Router } from "express";
import argon2 from "argon2";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import { db } from "../db.js";
import { env, googleEnabled } from "../env.js";
import { REFRESH_COOKIE, endSession, rotateSession, startSession } from "../tokens.js";

export const auth = Router();

const credentials = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

const signupBody = credentials.extend({ name: z.string().trim().max(100).default("") });

auth.post("/signup", async (req, res) => {
  const parsed = signupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const { email, password, name } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) {
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }
  const user = await db.user.create({
    data: { email, name, passwordHash: await argon2.hash(password) },
  });
  await startSession(res, user.id);
  res.status(201).json({ id: user.id });
});

auth.post("/login", async (req, res) => {
  const parsed = credentials.safeParse(req.body);
  const user = parsed.success
    ? await db.user.findUnique({ where: { email: parsed.data.email } })
    : null;
  // Same message for unknown email and wrong password: no account enumeration.
  const ok =
    parsed.success && user?.passwordHash
      ? await argon2.verify(user.passwordHash, parsed.data.password)
      : false;
  if (!user || !ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  await startSession(res, user.id);
  res.json({ id: user.id });
});

auth.post("/refresh", async (req, res) => {
  if (await rotateSession(res, req.cookies?.[REFRESH_COOKIE])) {
    res.json({ ok: true });
    return;
  }
  res.status(401).json({ error: "Session expired" });
});

auth.post("/logout", async (req, res) => {
  await endSession(res, req.cookies?.[REFRESH_COOKIE]);
  res.json({ ok: true });
});

auth.get("/providers", (_req, res) => {
  res.json({ google: googleEnabled });
});

// --- Google OAuth (authorization code flow, state cookie against CSRF) ---

const redirectUri = `${env.APP_URL}/api/auth/google/callback`;
const google = () => new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);

auth.get("/google", (_req, res) => {
  if (!googleEnabled) {
    res.status(404).json({ error: "Google sign-in is not configured" });
    return;
  }
  const state = crypto.randomUUID();
  res.cookie("oauth_state", state, { httpOnly: true, sameSite: "lax", maxAge: 10 * 60 * 1000 });
  res.redirect(google().generateAuthUrl({ scope: ["openid", "email", "profile"], state }));
});

auth.get("/google/callback", async (req, res) => {
  const { code, state } = req.query;
  if (!googleEnabled || typeof code !== "string" || state !== req.cookies?.oauth_state) {
    res.redirect(`${env.APP_URL}/login?error=oauth`);
    return;
  }
  res.clearCookie("oauth_state");
  try {
    const client = google();
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token ?? "",
      audience: env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.email || !p.email_verified) throw new Error("unverified Google email");
    const email = p.email.toLowerCase();
    // Link to an existing email account only because Google verified the address.
    const user = await db.user.upsert({
      where: { email },
      update: { googleId: p.sub },
      create: { email, googleId: p.sub, name: p.name ?? "" },
    });
    await startSession(res, user.id);
    res.redirect(`${env.APP_URL}/profile`);
  } catch (err) {
    console.error("google oauth failed", err);
    res.redirect(`${env.APP_URL}/login?error=oauth`);
  }
});
