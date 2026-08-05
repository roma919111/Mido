# VYRONIX.AI

A modern Next.js (App Router) studio for generating **AI images** and **AI videos** powered by [Google Gemini](https://ai.google.dev/).

## How billing works

Gemini runs **behind the scenes on the platform API key**.

- Customers generate with **no login** and **no token**
- Every image/video request hits the Gemini API from the server
- Usage bills the **owner Google AI Studio / Gemini API account** configured on the server

## Features

- Dark **VYRONIX.AI** workbench UI (Tailwind CSS)
- Mode switcher: Text-to-Image · Text-to-Video · Image-to-Video
- Prompt editor with **Enhance Prompt with AI**
- Start Frame + Reference Image dropzones (stored locally on the server)
- Video duration (5s / 10s) and quality (720p) via Gemini Omni Flash
- Media gallery with video player, download, and copy-prompt
- Next.js API routes → Gemini `generateContent` (images) and Interactions API (videos)

## Quick start

```bash
npm install
cp .env.example .env.local
# set GEMINI_API_KEY to your Google AI Studio API key
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — customers can generate immediately.

## Environment

```env
GEMINI_API_KEY=your_google_api_key

# optional overrides:
# GEMINI_VIDEO_MODEL=gemini-omni-flash-preview
# GEMINI_IMAGE_MODEL=gemini-2.5-flash-image
# APP_BASE_URL=http://localhost:3000
```

For production on **https://vyronix.app** (Vercel project `mido-g7aq`):

```env
GEMINI_API_KEY=your_google_api_key
APP_BASE_URL=https://vyronix.app
```

Add both in [Vercel → Settings → Environment Variables](https://vercel.com/roma919111s-projects/mido-g7aq/settings/environment-variables) for **Production**, then redeploy.

### Connect vyronix.app to Vercel

If `vyronix.app` shows **502**, Cloudflare is pointing at a dead origin (old Railway/tunnel). Fix:

1. **Vercel** → Project `mido-g7aq` → **Settings → Domains** → Add `vyronix.app` and `www.vyronix.app`
2. **Cloudflare** → DNS for `vyronix.app`:
   - Remove old origin/tunnel records that point to Railway or a dead server
   - Add the records Vercel shows (usually `CNAME` `@` → `cname.vercel-dns.com` or Vercel A records)
   - SSL/TLS mode: **Full**
3. Redeploy after adding `GEMINI_API_KEY`

Verify: `https://vyronix.app/api/account` should return `"configured": true` and `"provider": "gemini"`.

## API routes

| Route | Purpose |
| --- | --- |
| `GET /api/account` | Gemini configuration status |
| `POST /api/enhance` | Prompt enhancement |
| `POST /api/upload` | Store reference images locally |
| `POST /api/generate` | Gemini image/video generation |
| `GET /api/status` | Poll Gemini video generation status |
| `GET /api/creations` | Gallery history (client-side storage is primary) |
| `GET /api/media/gemini/[interactionId]` | Serve generated videos |
| `GET /api/media/gemini-image/[imageId]` | Serve generated images |
| `GET /api/media/upload/[uploadId]` | Serve uploaded reference images |

## Models used

- **Image:** `gemini-2.5-flash-image` via `generateContent`
- **Video:** `gemini-omni-flash-preview` via Gemini Interactions API (720p with audio)

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
