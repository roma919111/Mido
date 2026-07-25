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
# set AUTH_SECRET, OPENART_ACCESS_TOKEN (or complete owner OAuth once)
# optional: STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET
npm run dev
```

### Billing notes

- Customer wallet credits are deducted using **exact OpenArt quotes** when available.
- OpenArt MCP itself is billed to the **platform owner token**.
- Without Stripe keys, `/api/billing/checkout` activates the selected plan in **demo mode** and grants monthly credits for testing.
- Stripe webhook endpoint: `POST /api/billing/webhook`

### Owner OpenArt connection

All generations call OpenArt MCP with the platform owner credentials (`OPENART_ACCESS_TOKEN` or `.data/openart-owner.enc`).
