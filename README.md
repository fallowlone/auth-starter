# Auth Starter

![CI](https://github.com/fallowlone/auth-starter/actions/workflows/ci.yml/badge.svg)

Sign up, log in with email/password or Google, edit your profile.

Stack: React 19, TypeScript, Vite, Express 5, PostgreSQL, Prisma, Vitest, Supertest, Docker Compose.

## Security

| Concern | How it's handled |
|---|---|
| Passwords | argon2id hashes, never returned by the API |
| Sessions | 15-min access JWT + 30-day refresh token, both in `httpOnly` `SameSite=Lax` cookies (`Secure` in production) |
| Refresh tokens | Stored hashed (SHA-256), rotated on every refresh, single-use; a replay returns 401 |
| Login errors | Same response for unknown email and wrong password (no account enumeration) |
| Google OAuth | Authorization-code flow, `state` cookie against CSRF, ID token verified, only verified Google emails are linked |
| Input | zod validation on every body; 10 kB JSON limit |
| Abuse | Rate limit on `/api/auth/*`, `helmet` headers |

## Run locally

```bash
cp .env.example .env          # set JWT_SECRET (openssl rand -hex 32)
docker compose up -d db
npm install
npx -w server prisma migrate deploy
npm run dev                   # web http://localhost:5173, API :3000
```

Everything in containers: set `APP_URL=http://localhost:8080` in `.env`, run
`docker compose up --build`, open http://localhost:8080.

Google sign-in turns on when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. The
authorized redirect URI is `${APP_URL}/api/auth/google/callback`.

## Tests

```bash
npm test          # needs the db container; runs migrations, then Vitest + Supertest
npm run typecheck
```

Covered: signup and hashing, duplicate and invalid input, identical login errors, profile access
and edits, refresh rotation and replay, logout.

## API

| Method | Path | Auth |
|---|---|---|
| POST | `/api/auth/signup` `{email, password, name?}` | – |
| POST | `/api/auth/login` `{email, password}` | – |
| POST | `/api/auth/refresh` | refresh cookie |
| POST | `/api/auth/logout` | – |
| GET | `/api/auth/google` → callback | – |
| GET / PATCH | `/api/profile` `{name?, bio?}` | access cookie |

## Structure

```
server/  Express API: src/routes (auth, profile), src/tokens.ts (sessions), prisma/ (schema, migrations)
web/     React SPA: src/pages (AuthPage, ProfilePage), src/api.ts (fetch + silent refresh)
```
