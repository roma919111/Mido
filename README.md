# Veronix.ai

OpenArt-powered AI image & video studio with:

- OpenArt-style Create UI (models modal, visual refs, start/end frames, output settings)
- Live credit quotes via OpenArt MCP (`openart_model_cost`)
- Customer accounts (signup / login / logout)
- Assets history per customer
- Monthly subscriptions (Mini $10 / Standard $12.50 / Pro $15) via Stripe webhooks

## Setup

```bash
npm install
cp .env.example .env.local
# required: AUTH_SECRET, OPENART_ACCESS_TOKEN (or owner OAuth once), APP_BASE_URL
# for Google login: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
# for real payments: STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
npm run dev
```

### OpenArt credit sync (Generate button)

1. UI calls `POST /api/credits/quote` whenever models/output settings change.
2. Server calls OpenArt MCP tool `openart_model_cost` for each selected live model.
3. Button shows `−{totalCredits}` from that live quote (sum if multi-select).
4. On Generate, the same quote path is used again before deducting the customer wallet.

### Public preview URL (before buying a domain)

Stable free branded link: **https://vyronix-ai.loca.lt**

```bash
npm run start -- --hostname 0.0.0.0 --port 3000
npm run tunnel:vyronix   # keeps the same https://vyronix-ai.loca.lt name
```

Set `APP_BASE_URL=https://vyronix-ai.loca.lt`. When you later buy a real domain, change that one env var and update the Google redirect URI once. See `/setup/domain`.

### Google Sign-In

1. Google Cloud Console → APIs & Services → Credentials → OAuth client (Web).
2. Authorized redirect URI (preview): `https://vyronix-ai.loca.lt/api/auth/google/callback`
3. Put `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local` (once).
4. Customers use **Continue with Google** on `/login` and `/signup`.

### Billing / Stripe — what you need to provide

| Item | Where | Example |
|------|--------|---------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | `sk_test_...` |
| Webhook URL | Stripe → Developers → Webhooks | `{APP_BASE_URL}/api/billing/webhook` |
| Events | same webhook | `checkout.session.completed`, `invoice.paid` |
| `STRIPE_WEBHOOK_SECRET` | webhook signing secret | `whsec_...` |
| Optional price IDs | Products → Prices | `STRIPE_PRICE_MINI` etc. |

Without Stripe keys the app still runs: checkout uses **demo activation** and grants monthly credits for testing.

### Owner OpenArt connection

All generations call OpenArt MCP with the platform owner credentials (`OPENART_ACCESS_TOKEN` or `.data/openart-owner.enc`).
