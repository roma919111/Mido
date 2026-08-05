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

For production (e.g. Vercel), add `GEMINI_API_KEY` in the project environment settings.

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
