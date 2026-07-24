# Studio AI

A professional **OpenArt.ai-inspired** creator studio built with Next.js App Router, Tailwind CSS, Lucide icons, Supabase, and OpenArt MCP.

## Features

- Dark OpenArt-style shell: pitch-black canvas (`#0B0F17`), cyan neon accents, glassmorphism header/sidebar
- Left navigation: Home, Create/Generate, Community Feed, Workflows, Models, My Library, Settings
- Generation workbench: Text to Image, Text to Video, Image to Video, Inpaint / Edit
- Prompt tools: AI Enhance, Negative Prompt, Style Presets, Aspect Ratios, video duration/resolution
- Supabase auth + PostgreSQL schema for users, credits, generations, favorites
- Local demo auth/database fallback when Supabase env vars are not set
- OpenArt MCP generation via `@modelcontextprotocol/sdk`
- Community / private masonry feeds with download, copy prompt, reuse settings, like
- Upgrade modal: Free ($0 / 50), Pro ($15 / 1000), Master ($35 / 3500)

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Local demo mode (default)

If Supabase is not configured, Studio AI stores customers in `.data/studio-db.json`:

1. Sign up at `/signup` (starts with **50 credits**)
2. Generate on `/create` (image **-2**, video **-10**)
3. Browse `/community` and `/library`

### Supabase mode

1. Create a Supabase project
2. Run `supabase/schema.sql` in the SQL editor
3. Set:

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

### OpenArt MCP

```env
OPENART_ACCESS_TOKEN=your_oauth_bearer_token
OPENART_MCP_URL=https://mcp.openart.ai/mcp
```

Without an OpenArt token, generations still succeed in demo mode with sample media and are saved to the customer library.

## Credit costs

| Action | Credits |
| --- | --- |
| Generate Image / Inpaint | 2 |
| Generate Video | 10 |

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```
