# Setup

## Prerequisites

- Node.js 20.9+ (developed on Node 24)
- An [OpenRouter](https://openrouter.ai/keys) API key (free tier works)
- A Postgres database. [Neon](https://neon.tech) is recommended; optional for local runs.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run db:migrate           # once per new database
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | Recommended | Server-side key for the playground. Without it, users must paste their own key. |
| `DATABASE_URL` | Recommended | Postgres connection string. Without it, history and analytics are disabled (the app still works). |
| `OPENROUTER_DEFAULT_MODEL` | Optional | Playground default model id. Otherwise a verified free model is used. |

All variables are validated with zod at startup (`instrumentation.ts`). Misconfiguration is logged as a warning, never a crash. Secrets are only read on the server; nothing is prefixed `NEXT_PUBLIC_`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates route types, then `tsc --noEmit` |
| `npm test` | Vitest unit tests (`tests/`) |
| `npm run e2e -- http://localhost:3000` | Browser checks against a running server, using installed Edge (`E2E_BROWSER=chrome` for Chrome). Screenshots go to `e2e-shots/`. |
| `npm run db:generate` | Create a migration after editing `lib/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to `DATABASE_URL` |

## State management and responsive design

See the [README](README.md#state-management) for the full write-up. In short:
- The URL is the source of truth for shareable state (catalog filters, `/compare?models=`). It's parsed on the server for the first render, then mirrored with debounced `history.replaceState`.
- Interaction state lives in React (chat, calculator). Browser-persisted state (theme, compare tray, consent) uses `useSyncExternalStore` stores.
- Mobile-first layouts from 360px. Wide tables scroll inside their cards, and the compare matrix snaps column by column with a sticky label column.

## Deploy to Vercel

1. Push the repository to GitHub, then in Vercel choose **Add New → Project** and import it. Keep the framework defaults (Next.js, `npm run build`).
2. **Database**: in the Vercel project, open **Storage → Create → Neon** (this sets `DATABASE_URL`), or paste an existing Neon connection string under **Settings → Environment Variables**.
3. **Environment variables** (Production and Preview): `OPENROUTER_API_KEY`, `DATABASE_URL`, and optionally `OPENROUTER_DEFAULT_MODEL`.
4. **Migrate the production database** once from your machine with the production connection string:
   ```bash
   DATABASE_URL="postgresql://…" npm run db:migrate          # macOS/Linux
   $env:DATABASE_URL="postgresql://…"; npm run db:migrate     # Windows PowerShell
   ```
5. Deploy, then run the checklist below.

### Deploy checklist

- [ ] CI is green on the deployed commit (GitHub → Actions).
- [ ] Production migration applied: tables `requests` and `visits` exist (`npm run db:studio`, or the Neon console).
- [ ] Env vars set for Production: `OPENROUTER_API_KEY`, `DATABASE_URL`.
- [ ] **Deep link in a private window**: open `/compare?models=openai/gpt-6.1-terra,deepseek/deepseek-v4.1-flash-uncensored` in incognito; the matrix and cost estimator render on first load.
- [ ] Playground: send a prompt and see it stream, then find it under **History** (proves the production DB writes).
- [ ] Cookie banner: "Accept analytics" with a `?utm_campaign=test` link, then see the campaign on `/history`. "Essential only" removes it.
- [ ] Optional: run `npm run e2e -- https://<your-app>.vercel.app` against the deployment.
- [ ] Optional: add a few dollars of OpenRouter credits so free models allow more requests per day during review.
- [ ] Optional: clear test data from the database before sharing (`delete from requests; delete from visits;` in the Neon SQL editor).
