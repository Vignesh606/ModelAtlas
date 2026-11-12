# ModelAtlas

Next.js 16 (App Router, Cache Components on), React 19, strict TS, Tailwind v4, Drizzle + Neon Postgres, OpenRouter. Hiring-trial app; the author must be able to explain every line, so keep code simple and commented.

## Commands
- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` (runs `next typegen` first) · `npm test` (Vitest, `tests/`)
- `npm run db:generate` (after editing `lib/db/schema.ts`) · `npm run db:migrate`

## Map
- `app/` routes: `/` catalog, `/models/[...id]`, `/compare`, `/playground`, `/history`, `/privacy`; APIs in `app/api/{chat,history,providers,models,track}`
- `lib/` pure logic + server data: `data.ts` (OpenRouter, `"use cache"`), `catalog.ts`, `compare-url.ts`, `cost.ts`, `chat*.ts`, `sse.ts`, `history*.ts`, `visits.ts`, `utm.ts`, `consent.ts`, `env.ts`, `db/`
- `components/` UI; `components/site/` site-wide (palette, menu, FAQ, cookie banner, floating layer)

## Conventions
- Colors only via tokens in `app/globals.css` (`bg-surface`, `text-muted`, …); emerald `accent` only for lowest-price/best-value badges and focus rings. Contrast is AA-checked.
- `usePathname`/`useSearchParams` in layout-level client components must sit inside `<Suspense>` (Cache Components).
- Client islands that take server state get a `key` from it (Next keeps pages mounted via `<Activity>`).
- Scroll containers that hold `sr-only` children need `relative`.
- API errors: `apiError(code, message, status)` → `{ error: { code, message } }`.
- Never return `sessionId` from APIs; never read or print `.env.local` (secrets).
- Commit messages: conventional, no Co-Authored-By / "Generated with" lines.

## Next 16 docs
Bundled at `node_modules/next/dist/docs/`. Grep the specific API you need instead of reading whole files.
