import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { db } from "../src/db.js";

const app = createApp();
const user = { email: "Ada@Example.com", password: "correct-horse-battery", name: "Ada" };

beforeEach(async () => {
  await db.session.deleteMany();
  await db.user.deleteMany();
});
afterAll(() => db.$disconnect());

const signup = () => request.agent(app).post("/api/auth/signup").send(user);

describe("auth", () => {
  it("signs up, stores a hashed password and sets httpOnly cookies", async () => {
    const res = await signup();
    expect(res.status).toBe(201);
    const cookies = res.headers["set-cookie"] as unknown as string[];
    expect(cookies.some((c) => c.startsWith("access_token=") && c.includes("HttpOnly"))).toBe(true);
    const row = await db.user.findUniqueOrThrow({ where: { email: "ada@example.com" } });
    expect(row.passwordHash).toMatch(/^\$argon2/);
  });

  it("rejects a duplicate email and a short password", async () => {
    await signup();
    expect((await signup()).status).toBe(409);
    const short = await request(app)
      .post("/api/auth/signup")
      .send({ email: "b@example.com", password: "123" });
    expect(short.status).toBe(400);
  });

  it("gives the same error for wrong password and unknown email", async () => {
    await signup();
    const wrong = await request(app)
      .post("/api/auth/login")
      .send({ email: user.email, password: "nope-nope-nope" });
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.com", password: "nope-nope-nope" });
    expect([wrong.status, unknown.status]).toEqual([401, 401]);
    expect(wrong.body).toEqual(unknown.body);
  });

  it("reads and edits the profile only when logged in", async () => {
    expect((await request(app).get("/api/profile")).status).toBe(401);
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send(user);
    const me = await agent.get("/api/profile");
    expect(me.body).toMatchObject({ email: "ada@example.com", name: "Ada" });
    expect(me.body.passwordHash).toBeUndefined();
    const edited = await agent.patch("/api/profile").send({ name: "Ada L.", bio: "Math" });
    expect(edited.body).toMatchObject({ name: "Ada L.", bio: "Math" });
  });

  it("rotates refresh tokens and makes the old one single-use", async () => {
    const res = await signup();
    const cookies = res.headers["set-cookie"] as unknown as string[];
    const refresh = cookies.find((c) => c.startsWith("refresh_token="))!.split(";")[0];
    const first = await request(app).post("/api/auth/refresh").set("Cookie", refresh);
    expect(first.status).toBe(200);
    const replay = await request(app).post("/api/auth/refresh").set("Cookie", refresh);
    expect(replay.status).toBe(401);
  });

  it("logout clears the session", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send(user);
    await agent.post("/api/auth/logout");
    expect((await agent.get("/api/profile")).status).toBe(401);
    expect(await db.session.count()).toBe(0);
  });
});
