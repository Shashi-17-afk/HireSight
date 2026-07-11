# Contributing to HireSight

Thank you for taking the time to contribute! This document covers local setup, branch conventions, and the checks required before opening a pull request.

---

## Table of Contents

1. [Local Setup](#local-setup)
2. [Environment Variables](#environment-variables)
3. [Database Migrations](#database-migrations)
4. [Development Server](#development-server)
5. [Branch Naming](#branch-naming)
6. [Before You Open a PR](#before-you-open-a-pr)
7. [Commit Style](#commit-style)

---

## Local Setup

**Prerequisites:** Node.js ≥ 18, npm ≥ 9, a free [Cloudflare account](https://dash.cloudflare.com/sign-up).

```bash
# 1. Clone
git clone https://github.com/Shashi-17-afk/Cloudflare_Hackathon.git
cd Cloudflare_Hackathon

# 2. Install dependencies
npm install

# 3. Authenticate Wrangler with your Cloudflare account
npx wrangler login
```

---

## Environment Variables

```bash
# Copy the example file
cp .env.example .dev.vars

# Edit .dev.vars and set a real JWT_SECRET
# Generate one: openssl rand -hex 32
```

> **Never commit `.dev.vars`** — it is in `.gitignore`.  
> In production, set secrets via `wrangler secret put JWT_SECRET`.

---

## Database Migrations

```bash
# Apply schema to your local D1 database
npm run db:migrate:local

# Apply schema to production D1 (requires Cloudflare auth)
npm run db:migrate:remote
```

If you add a new migration file, name it `migrations/000N_description.sql` (incrementing the prefix) and add a corresponding npm script entry in `package.json`.

---

## Development Server

```bash
npm run dev
```

This starts:
- **Vite** dev server for the React frontend (with HMR)
- **Workerd** local runtime for the Cloudflare Worker (via `@cloudflare/vite-plugin`)

The React app proxies `/api/*` requests to the local Worker automatically.

---

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feat/<short-description>` | `feat/candidate-notifications` |
| Bug fix | `fix/<short-description>` | `fix/ws-reconnect-loop` |
| Chore / docs | `chore/<short-description>` | `chore/update-readme` |
| Security | `security/<short-description>` | `security/rate-limit-apply` |

Branch off `main`. Keep branches focused — one concern per PR.

---

## Before You Open a PR

Run these checks locally. All must pass:

```bash
# 1. TypeScript — zero type errors
npm run build

# 2. Formatting — ensure code matches .prettierrc
npx prettier --check "src/**/*.{ts,tsx}"

# To auto-fix formatting:
npx prettier --write "src/**/*.{ts,tsx}"
```

> There are currently no automated tests. If you add a test suite (Vitest is the recommended choice for this stack), add `npm test` to the checklist above and update this file.

**PR checklist:**

- [ ] `npm run build` exits 0
- [ ] Code formatted with Prettier
- [ ] New environment variables documented in `.env.example`
- [ ] New D1 columns/tables covered by a migration file
- [ ] `wrangler types` re-run if `wrangler.toml` bindings changed (`npm run cf-typegen`)
- [ ] Description explains *why*, not just *what*

---

## Commit Style

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short summary>

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `chore`, `refactor`, `security`, `perf`

**Examples:**

```
feat(leaderboard): add tie-breaking by submission time
fix(auth): remove JWT_SECRET default fallback
security(cors): restrict origin to production domain
docs(readme): add architecture diagram
```
