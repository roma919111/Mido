<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single service: a Next.js 16 (App Router, Turbopack) dev server (VYRONIX / Veronix.ai — an AI video + image studio with customer accounts, a credit wallet, and Stripe subscriptions). Standard scripts live in `package.json` (`dev`, `build`, `start`, `lint`); start dev with `npm run dev` (serves `http://localhost:3000`).

- OpenArt has been fully retired. Generation runs on BytePlus ModelArk (Seedance video / Seedream image) via `src/lib/byteplus-ark.ts` + `src/lib/byteplus-image.ts`. `src/lib/openart-mcp.ts` is a hard-disabled stub and OpenArt setup/OAuth routes return 410 — do not reintroduce OpenArt.
- Actual video/image generation requires `BYTEPLUS_API_KEY` (see `.env.example`). Without it, `POST /api/generate` returns HTTP 503 (`needsOwnerSetup`) — the app, signup/login, studio UI, and pricing still work; only generation is gated.
- No automated test suite exists (no `test` script). `npm run lint` currently reports pre-existing `react-hooks/set-state-in-effect` and React Compiler errors in app components (e.g. `src/components/veronix/VeronixApp.tsx`); these predate setup and do not block `npm run build`.
- Customer accounts, wallet, and assets persist to a local JSON DB at `.data/veronix-db.json` (gitignored) by default — no external database needed. Sessions are JWT cookies signed with `AUTH_SECRET` (falls back to a dev default if unset). New accounts start with 0 credits / free plan and one free 480p Veronix video trial.
- Optional integrations (all gated by env vars, app runs without them): Stripe (`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`), Google Sign-In (`GOOGLE_CLIENT_ID`/`SECRET`), and vision prompt-enhance (`OPENAI_API_KEY` or `GEMINI_API_KEY`).
- Note: `main` is a stale OpenArt-era snapshot; the current product lives on the BytePlus branches (`cursor/vyronix-ai-rebranding-ad0d` + the OpenArt-removal branch). Verify you are on up-to-date code before developing.
