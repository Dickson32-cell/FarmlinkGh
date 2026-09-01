# FarmLink Ghana 🇬🇭

FarmLink Ghana is a marketplace connecting farmers directly with bulk buyers (restaurants, schools, exporters, market traders) — with admin-verified Ghana Card identity checks, escrow-style payments, and admin commission tracking.

**Live:** https://framlinkgh.vercel.app
**Repo:** https://github.com/Dickson32-cell/FramlinkGh

---

## Architecture

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database | Neon PostgreSQL (serverless) |
| ORM | Prisma 6 |
| Auth | JWT sessions (jose) + SMS OTP (Arkesel) + **Admin email codes** |
| Payments | **Paystack (GHS)** — primary; manual MoMo fallback to ADMIN_MOMO |
| Hosting | Vercel (auto-deploy from `main` branch) |
| Uploads | Files stored in Postgres (BYTEA), served via `/api/files/[id]` |

## How admin authentication works (SECURITY)

1. Admin enters phone `0244000000` + password on /login
2. An **8-digit code is emailed to `ADMIN_EMAIL` (dicksonapam@gmail.com)**
3. Admin enters the code → gets a **12-hour verified admin session**
4. **Releasing farmer payments** requires a **second fresh email code** (step-up, 10-min window)
5. All admin API endpoints reject any session without the `adminVerified` claim

Where codes appear:
- **Vercel dashboard → framlinkgh → Deployments → latest → Functions/Logs** (search `ADMIN-EMAIL`) — until real email delivery is turned on
- **Real email delivery** (recommended): add ONE of these as a Vercel env var — zero code changes:
  - `RESEND_API_KEY` (free tier at resend.com) — easiest
  - `SMTP_USER` + `SMTP_PASSWORD` (Gmail App Password) — Gmail: Account → Security → 2FA → App passwords

## Ghana Card uploads (fixed)

Cards are stored **inside the database** and are **PRIVATE**:
- Only the account owner and a verified admin session can view a card
- Everyone else gets 404 (even logged-in users can't see other people's cards)
- Listing photos are public and cached

## Environment variables (all set on Vercel ✅)

`DATABASE_URL`, `JWT_SECRET`, `ADMIN_EMAIL`, `CRON_SECRET`, `PAYSTACK_SECRET_KEY`, `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`, `PAYSTACK_FEE_RATE`, `NEXT_PUBLIC_APP_URL`, `SMS_PROVIDER=arkesel`, `ARKESEL_API_KEY`, `ARKESEL_SENDER_ID`, `HUBTEL_*`, `ADMIN_MOMO`, `COMMISSION_RATE`, `HUBTEL_FEE_RATE`

All values live in the local `.env` (never committed).

## Logins (production)

| Role | Phone | Password |
|------|-------|----------|
| **Admin** | 0248847819 | *(strong password — rotate from the login page)* |

Production DB holds **only real accounts** — there is no demo data. `prisma/seed.ts`
creates the admin account only (for fresh databases); it creates **zero** demo
farmers/buyers/listings/prices. Real farmers and buyers register through the site.

**Payments:** Paystack is the primary provider. Test keys are currently configured;
swap `PAYSTACK_SECRET_KEY` / `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` in Vercel for live
keys when going live. If Paystack is unavailable, buyers see manual MoMo
instructions to ADMIN_MOMO (0248847819).

## Development

```bash
npm install            # prisma generate runs automatically (postinstall)
npm run dev            # http://localhost:3001
npm run build          # prisma generate + next build
npm run seed           # re-seed demo data (careful in prod)
```

## Auto-release cron

48 hours after buyer confirms delivery, orders auto-release to the farmer. Call `/api/cron/auto-release` hourly with header `x-cron-secret: $CRON_SECRET` (cron-job.org, Vercel Cron, or GitHub Actions).

## Deployment

Push to `main` → Vercel auto-builds and deploys. Build needs the `postinstall: prisma generate` script + `.npmrc` allow-scripts (npm 11 blocks Prisma's install hooks otherwise) — both committed.

## Troubleshooting

- **"Unable to open the database file"** → old SQLite code; deploy latest `main`
- **Prisma client errors on Vercel** → ensure `postinstall` script + `.npmrc` are committed
- **Admin code not arriving** → check Vercel function logs for `[ADMIN-EMAIL]`, or add `RESEND_API_KEY` for real email
- **Upload fails** → confirm deployment is on commit `7cea1d7` or later