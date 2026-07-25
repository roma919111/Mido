# VYRONIX.AI

A modern Next.js (App Router) studio for generating **AI images** and **AI videos** powered by [OpenArt MCP](https://mcp.openart.ai/mcp).

## Features

- Dark **VYRONIX.AI** workbench UI (Tailwind CSS)
- Mode switcher: Text-to-Image · Text-to-Video · Image-to-Video
- Prompt editor with **Enhance Prompt with AI**
- Start Frame + Reference Image dropzones
- Video duration (5s / 10s) and quality (720p / 1080p)
- Credit balance + Upgrade CTA
- Media gallery with video player, download, and copy-prompt
- Next.js API routes using `@modelcontextprotocol/sdk` → `https://mcp.openart.ai/mcp`

## Quick start

```bash
npm install
cp .env.example .env.local
# set AUTH_SECRET and APP_BASE_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Sign in with OpenArt**.

There is no demo mode — Generate Image / Generate Video call live OpenArt MCP (`https://mcp.openart.ai/mcp`) via `@modelcontextprotocol/sdk`, and the UI shows the raw live response or error.

## OpenArt OAuth

VYRONIX.AI runs the MCP OAuth authorization-code + PKCE flow against OpenArt:

1. `GET /api/auth/login` — dynamic client registration + redirect to OpenArt
2. `GET /api/auth/callback` — exchanges the code for tokens (stored in an encrypted HttpOnly cookie)
3. API routes use the session access token (with refresh) for `https://mcp.openart.ai/mcp`

```env
AUTH_SECRET=replace-with-a-long-random-string
APP_BASE_URL=http://localhost:3000
OPENART_MCP_URL=https://mcp.openart.ai/mcp
# Optional headless fallback only:
# OPENART_ACCESS_TOKEN=
```

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/auth/login` | Start OpenArt OAuth (DCR + PKCE) |
| `GET /api/auth/callback` | OAuth redirect handler |
| `GET/POST /api/auth/logout` | Clear OAuth session cookie |
| `GET /api/auth/session` | Auth status (`oauth` / `env` / needsAuth) |
| `GET /api/account` | Credits / plan via `openart_account_get` |
| `POST /api/enhance` | Prompt enhancement |
| `POST /api/upload` | Sign + PUT reference images via `openart_upload_sign` |
| `POST /api/generate` | `openart_generate_image` / `openart_generate_video` + wait |
| `GET /api/status` | Poll `openart_creation_get` |
| `GET /api/creations` | List history via `openart_creation_list` |

## Models used

- **Image:** `nano-banana-2-lite` (`text2image` / `image2image`)
- **Video:** `pixverseV6` (`text2video` / `image2video`) with Standard `720p` or Pro `1080p`

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
