import express, { type ErrorRequestHandler } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { auth } from "./routes/auth.js";
import { profile } from "./routes/profile.js";
import { env } from "./env.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });
  app.use(
    "/api/auth",
    rateLimit({ windowMs: 15 * 60 * 1000, limit: env.NODE_ENV === "test" ? 1000 : 50 }),
    auth,
  );
  app.use("/api/profile", profile);

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: "Something went wrong" });
  };
  app.use(onError);
  return app;
}
