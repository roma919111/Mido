# Studio AI

A modern Next.js (App Router) studio for generating **AI images** and **AI videos** powered by [OpenArt MCP](https://mcp.openart.ai/mcp).

## Features

- Dark **Studio AI** workbench UI (Tailwind CSS)
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
# add OPENART_ACCESS_TOKEN
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Without `OPENART_ACCESS_TOKEN`, the app runs in **demo mode** (sample media + **10 Free Credits**) so the UI stays fully usable. Demo costs: image `1`, video `2–4` credits depending on duration/quality.

## OpenArt auth

OpenArt MCP authenticates via OAuth (no long-lived API key). After you connect `https://mcp.openart.ai/mcp` in an MCP-compatible client and sign in, set:

```env
OPENART_ACCESS_TOKEN=your_bearer_token
OPENART_MCP_URL=https://mcp.openart.ai/mcp
```

## API routes

| Route | Purpose |
| --- | --- |
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
