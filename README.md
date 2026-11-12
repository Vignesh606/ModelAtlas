# ModelAtlas

Discover, compare and try AI models in one place: a model catalog, a side-by-side **comparison and monthly cost estimator**, and a streaming **AI playground** with persistent request history.

**Live demo:** _add your Vercel URL here_ · **Setup and deployment:** [SETUP.md](SETUP.md)

Built with Next.js 16 (App Router, Cache Components), React 19, strict TypeScript, Tailwind CSS v4, Drizzle ORM + Neon Postgres, and OpenRouter.

## Features

| Area | What it does |
| --- | --- |
| **Catalog** (`/`) | 450+ live models from OpenRouter. Debounced search, lab and capability filters (reasoning, tool calling, vision, open weights, 1M+ context, free, hide deprecated), sortable columns, table or card view, pagination. All filter state lives in the URL. Hero stats with releases per month and capability coverage. |
| **Model detail** (`/models/[...id]`) | Pricing (incl. cache), limits, modalities, capabilities, benchmarks, and a per-provider price table with the cheapest provider badged. "Try in Playground" and "Add to compare". |
| **Compare** (`/compare`) | 2 to 4 models from an accessible combobox. A matrix of context, modalities, prices (lowest badged), monthly bill, benchmarks and providers; on mobile it swipes with a sticky label column. **Cost estimator**: log-scale sliders plus exact inputs, presets (chatbot, RAG, code agent), and a "Best value / saves $X/mo" badge. **Deep links**: `/compare?models=a/b,c/d` renders fully on first load (incognito-safe). Malformed, unknown, duplicate or extra ids are skipped with a notice. |
| **Playground** (`/playground`) | Streaming chat over SSE with stop (Esc), regenerate, copy, Markdown and syntax highlighting, and collapsible model reasoning. **Side-by-side** mode sends one prompt to two models. Optional system prompt, temperature and max tokens (only what the model supports). Optional bring-your-own key, kept in memory only. Each reply shows tokens, latency and projected monthly cost. |
| **History** (`/history`) | Every playground request is saved with tokens, cost, latency and status. Search, model filter, pagination, detail view, CSV/JSON export, an analytics strip (requests, tokens, average latency, success rate, requests per model) and campaign counts. |
| **Site-wide** | Light/dark/system theme with no flash. Ctrl/⌘K command palette (models, pages, FAQ, add to compare). Accessible mobile menu, FAQ accordion, scroll progress, back-to-top, contact panel, cookie banner, and consent-gated UTM analytics. |

## Architecture

```
Browser ──────────────────────────────────────────────────────────────────────
  Server-rendered pages (static shell + streamed request-time parts)
  Client islands: catalog filters · compare view · playground · palette · menu
        │  URL params (filters, ?models=)      │ SSE stream          │ fetch
        ▼                                       ▼                     ▼
Next.js server (Vercel functions) ───────────────────────────────────────────
  Pages / Server Components ── lib/data.ts ("use cache", hourly) ─┐
  POST /api/chat ── validate → rate-limit → OpenRouter (stream) ──┤── OpenRouter API
     └─ after(): save request ────────────────────────┐            │  (models, endpoints,
  /api/history · /api/history/[id] · /export · DELETE │            │   chat completions)
  /api/track (consent-gated) · /api/providers · /api/models        │
                                                      ▼            │
                                  Neon Postgres (Drizzle): requests, visits
```

- **Data**: `lib/data.ts` fetches OpenRouter's public model list on the server and validates it with zod. It's cached with `"use cache"` + `cacheLife("hours")`. On failure the app serves sample data, cached for minutes only so it recovers quickly.
- **Rendering**: Cache Components (partial prerendering). Static parts like the hero are prerendered. Anything that reads the URL, cookies or the database streams in behind `<Suspense>` with skeleton fallbacks.
- **Chat**: `/api/chat` turns OpenRouter's stream into four normalized events (`delta`, `reasoning`, `done` with usage and latency, `error`). The client never depends on the upstream format. Errors before streaming use real status codes (400/401/402/429/502/504); errors after streaming starts arrive as events.
- **Providers**: besides OpenRouter, the playground can call OpenAI, Anthropic, Google Gemini, Groq, DeepSeek, Mistral, xAI, Together and Fireworks through their OpenAI-compatible endpoints (`lib/providers.ts`). The user pastes their own key in Settings, and `/api/provider-models` lists the models that key can use. These providers publish no prices, so cost projection only shows when the provider reports cost.

## State management

- **The URL is the state** wherever links should be shareable: catalog filters and `/compare?models=`. The server parses the URL for the first render, so a pasted link renders fully. The client then owns the state and mirrors it back with `history.replaceState`, debounced, with no navigation and no extra history entries.
- **Local React state** for interaction-only data: chat conversations (one `useChat` hook per pane), calculator usage, open menus.
- **`useSyncExternalStore`** stores for browser-persisted values: theme (localStorage), compare tray (localStorage), cookie consent (a cookie, so the server can verify it).
- **Server data** stays on the server where possible. History pages query Postgres directly in Server Components, and the catalog list is sent to the client island once.
- Next 16 keeps visited pages mounted (`<Activity>`). Client islands seeded from the URL are keyed on that state, so a navigation to a different URL remounts them instead of showing stale state.

## Responsive strategy

- Mobile-first Tailwind; verified from 360px to wide desktop with no page-level horizontal overflow (checked automatically by `npm run e2e`).
- Wide tables scroll inside their card (catalog, providers). The compare matrix uses scroll-snap columns with a sticky label column.
- Header nav collapses into an accessible slide-down menu. The floating controls (back-to-top, contact, cookie banner) share one layer, stack without overlapping, and sit above the compare tray.
- Grids declare `grid-cols-1` on mobile so long content can't widen the page.

## Data model

```
requests                                   visits (analytics consent only)
  id uuid pk                                 id uuid pk
  session_id uuid      ─┐ index              session_id uuid      ─┐ index
  created_at timestamptz┘ (session, time)     created_at timestamptz┘ (session, time)
  model text            index                path text
  prompt text, response text                 utm_source/medium/campaign/term/content text
  prompt_tokens, completion_tokens,          referrer text (origin + path only)
  total_tokens int, cost_usd float8                index on utm_campaign
  latency_ms int
  status enum(success, error, aborted)
  error_message text
```

Migrations live in `drizzle/` (SQL, committed). Ownership is an anonymous session id in an httpOnly cookie. Every query is scoped to it, and another session's id returns 404.

## Real vs sample data

- **Real**: model list, prices, context, modalities, capabilities, release dates and providers come from OpenRouter. Intelligence/coding/agentic scores are Artificial Analysis indexes, provided through OpenRouter.
- **Sample**: the three models from the assessment brief (`lib/data/dummy-models.json`). Two are not on OpenRouter; they are labelled "Sample" and can be compared but not chatted with. Sample benchmark values only fill gaps in live data and are marked **†** everywhere.
- No numbers are invented: anything unknown shows "-".

## Privacy and cookies

| Cookie / storage | Purpose | Consent |
| --- | --- | --- |
| `ma_session` (httpOnly, 1 year) | Ties playground history and rate limits to this browser | Strictly necessary |
| `ma_consent` (1 year) | Remembers the cookie choice | Strictly necessary |
| `ma_utm` (30 days) | First-touch campaign attribution | Only after "Accept analytics" |
| localStorage | Theme, compare tray | Never sent to the server |

Nothing analytics-related is stored or sent before consent: the landing URL is held in memory only. `/api/track` re-checks consent on the server. Switching to "Essential only" removes `ma_utm` and deletes recorded page views. "Delete my data" (on `/privacy` and `/history`) removes history and page views. A user's own API key is never stored or logged. Prompts are sent to OpenRouter to generate replies.

## Quality

- Strict TypeScript with no `any`. zod at every boundary: env, OpenRouter responses, API bodies, cookies, SSE events.
- **96 unit tests** (Vitest): cost formula, URL parse/serialize with malformed ids, price/context formatting, request schema, SSE parsing and stream transform, rate limiting, error mapping, UTM parsing, CSV injection guards, Markdown safety.
- **104 browser checks** (`npm run e2e`): deep links, combobox, calculator, playground streaming and stop, history, consent and UTM flow, command palette, mobile menu focus trap, stacking, and overflow at 360px.
- Accessibility: skip link, labelled controls, WAI-ARIA combobox/listbox, `role="log"` with `aria-busy` replies, visible focus everywhere, reduced-motion support, WCAG AA contrast checked by calculation for every token pair.
- CI (GitHub Actions): lint, typecheck, tests and production build on every push.

## Known limitations

- **Free-model limits**: the shared key relies on OpenRouter's free tier, which has per-minute and daily caps. Under load the playground shows a friendly "rate-limited" message. Adding credits to the OpenRouter account raises the caps.
- **Rate limiting** is in memory, so on serverless it's per instance (best effort). A shared store (Redis or the database) would make it global.
- **Unknown model URLs** render the not-found page with `noindex`, but can return HTTP 200 on first render. This is documented Next.js streaming behaviour with Cache Components.
- **Pricing** uses each model's default price: no long-context tiers, caching or batch discounts in the estimate. A provider filter would need one request per model, so providers appear on detail and compare pages only.
- Stopping a reply stops billing only for providers that support cancellation (per OpenRouter).

## What I'd improve with more time

- A shared rate limiter and a usage budget per session; streaming retries with fallback models.
- Per-provider pricing in the estimator (choose the provider, include caching).
- Saved comparisons and history sharing behind optional sign-in.
- Visual regression tests in CI (running the e2e suite against preview deployments).
- Virtualized catalog table and server-side search for much larger catalogs.
