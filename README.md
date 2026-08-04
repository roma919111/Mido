# VYRONIX.AI

A modern Next.js (App Router) studio for generating **AI images** and **AI videos** powered by [OpenArt MCP](https://mcp.openart.ai/mcp).

## How billing works

OpenArt runs **behind the scenes on the platform owner account**.

- Customers generate with **no login** and **no token**
- Every image/video request hits OpenArt MCP from the server
- Credits are deducted from the **owner OpenArt account** configured on the server

## Features

- Dark **VYRONIX.AI** workbench UI (Tailwind CSS)
- Mode switcher: Text-to-Image · Text-to-Video · Image-to-Video
- Prompt editor with **Enhance Prompt with AI**
- Start Frame + Reference Image dropzones
- Video duration (5s / 10s) and quality (720p / 1080p)
- Media gallery with video player, download, and copy-prompt
- Next.js API routes using `@modelcontextprotocol/sdk` → `https://mcp.openart.ai/mcp`

## Quick start

```bash
npm install
cp .env.example .env.local
# set OPENART_ACCESS_TOKEN to the OWNER OpenArt account token
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — customers can generate immediately.

## Connect the owner OpenArt account

### Option A (recommended): server env token

```env
OPENART_ACCESS_TOKEN=owner_bearer_token
OPENART_MCP_URL=https://mcp.openart.ai/mcp
AUTH_SECRET=replace-with-a-long-random-string
```

### Option B: one-time owner OAuth setup

1. Set `AUTH_SECRET` + `APP_BASE_URL`
2. Optionally set `OWNER_SETUP_KEY`
3. Visit `/api/auth/login` (or `/api/auth/login?key=...`)
4. Tokens are stored server-side in `.data/openart-owner.enc` (gitignored)

Customers never see this flow.

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/auth/login` | Owner-only OpenArt connect (optional) |
| `GET /api/auth/callback` | Owner OAuth callback |
| `GET/POST /api/auth/logout` | Clear owner credentials (setup key required if set) |
| `GET /api/auth/session` | Platform connection status |
| `GET /api/account` | Owner account credits/plan via `openart_account_get` |
| `POST /api/enhance` | Prompt enhancement |
| `POST /api/upload` | Sign + PUT reference images via `openart_upload_sign` |
| `POST /api/generate` | `openart_generate_image` / `openart_generate_video` + wait |
| `POST /api/credits/quote` | Live credit estimate for model/duration/resolution/audio |
| `GET /api/status` | Poll `openart_creation_get` |
| `GET /api/creations` | List history via `openart_creation_list` |

## Models used

- **Image:** `nano-banana-2-lite` (`text2image` / `image2image`) — flat **15 credits**
- **Video:** `pixverseV6` (`text2video` / `image2video`) — **per-second** billing from `src/config/modelPricing.ts`

### Video credit rates (PixVerse V6, credits/sec)

| Resolution | No audio | With audio |
|------------|----------|------------|
| 360p | 35 | 48 |
| 540p | 48 | 62 |
| 720p | 62 | 83 |
| 1080p | 124 | 158 |

Total cost = `ceil(creditsPerSecond × durationSeconds)`. Currency: **$1 = 1,000 credits**.

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
