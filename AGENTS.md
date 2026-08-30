<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Single service: a Next.js 16 (App Router, Turbopack) dev server. Standard scripts live in `package.json` (`dev`, `build`, `start`, `lint`). Start dev with `npm run dev` (serves `http://localhost:3000`).

- There are no automated tests in this repo (no `test` script).
- Image/video generation (`/api/generate`, `/api/account`, `/api/creations`, etc.) calls OpenArt MCP and requires the owner token `OPENART_ACCESS_TOKEN` (set as a secret, or in `.env.local`). Without it the UI loads and shows a "Platform OpenArt account is not connected" banner, and generation returns HTTP 401. The `/api/enhance` prompt-enhancement route is fully local and works with no token.
- `.env.example` documents all env vars; copy to `.env.local` for local overrides. `AUTH_SECRET` only matters if using the optional owner OAuth flow (stores credentials in gitignored `.data/`).
