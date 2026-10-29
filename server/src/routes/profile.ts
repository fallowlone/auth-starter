import { Router } from "express";
import { z } from "zod";
import { db } from "../db.js";
import { requireAuth, type AuthedRequest } from "../tokens.js";

export const profile = Router();

const publicFields = { id: true, email: true, name: true, bio: true, createdAt: true } as const;

profile.get("/", requireAuth, async (req: AuthedRequest, res) => {
  const user = await db.user.findUnique({ where: { id: req.userId }, select: publicFields });
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(user);
});

const update = z.object({
  name: z.string().trim().max(100).optional(),
  bio: z.string().trim().max(500).optional(),
});

profile.patch("/", requireAuth, async (req: AuthedRequest, res) => {
  const parsed = update.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0].message });
    return;
  }
  const user = await db.user.update({
    where: { id: req.userId },
    data: parsed.data,
    select: publicFields,
  });
  res.json(user);
});
