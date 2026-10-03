# Kuro's Portfolio

HTML/CSS/JavaScript frontend for GitHub Pages, with Vercel APIs for Stripe donations, private Discord orders, and Minecraft status. Never commit private credentials.

## Fix the backend connection

The message about requests not being configured means the frontend has no backend URL. Adding a Stripe secret in Vercel does not configure that URL.

For GitHub Pages, edit `js/config.js`:

```js
export const API_BASE_URL = 'https://kuroportfolio.vercel.app';
```

Use your actual public Vercel origin, without a trailing slash or `/api`. An empty value works on localhost and the backend's own `*.vercel.app` site. Custom frontend domains need an explicit backend URL too.

The frontend is configured for `https://kuro.iconrealms.net/` and the backend for `https://kuroportfolio.vercel.app`. Set these production environment variables in Vercel, then redeploy:

```text
FRONTEND_URL=https://kuro.iconrealms.net/
ALLOWED_ORIGINS=https://kuro.iconrealms.net,https://kuroportfolio.vercel.app
```

Do not include `index.html` in either value. `SITE_URL` defaults to `https://kuro.iconrealms.net/`; set the GitHub Actions variable to that value if overriding it. Private Stripe, Discord, and management credentials remain Vercel-only.

## Local development

Install Node.js 22+, then run `npm install` and `npm run dev`. Use `npm.cmd` on Windows if PowerShell blocks npm scripts. Copy `.env.example` to `.env` for local API credentials. Do not commit `.env`.

Run `npm test` for backend tests. For browser tests, install Chromium with `npx playwright install chromium`, then run `npm run test:browser`. Tests mock external payments and Discord; they do not make live charges.

## GitHub Pages

1. Create a repository and upload the source, including `.github/workflows/pages.yml`, `package.json`, and `package-lock.json`. Exclude `.env`, credentials, and `node_modules`.
2. Configure the public API URL in `js/config.js`, then push to `main`.
3. In repository Settings → Pages, select **GitHub Actions**. The included workflow builds and publishes `dist`; its static allowlist excludes backend code and environment files from the Pages artifact.
4. Set the repository Actions variable `SITE_URL` to your full frontend URL ending in `/`, such as `https://YOUR-NAME.github.io/YOUR-REPO/`, for canonical URLs, social metadata, and sitemap generation.
5. Publish updates by committing and pushing to `main`:

```sh
git add .
git commit -m "Update portfolio"
git push origin main
```

For a custom domain, set it in GitHub Pages settings, follow GitHub's DNS instructions, and enable HTTPS. Update `SITE_URL` and the backend frontend/CORS settings below.

## Vercel

Import the same GitHub repository. Choose the **Other** framework preset and repository root. `vercel.json` configures `npm run build` and the static `dist` output. Root `api/*.js` files become serverless routes independently of that static output.

Set these Vercel environment variables:

| Variable | Value |
| --- | --- |
| `STRIPE_SECRET_KEY` | Private Stripe secret key |
| `FRONTEND_URL` | Full frontend base URL, including repository path, ending in `/` |
| `ALLOWED_ORIGINS` | Comma-separated browser origins, without paths or trailing slashes |
| `DISCORD_ORDER_WEBHOOK_URL` | Private Discord channel webhook URL |
| `ORDER_ADMIN_KEY` | Random private management key, at least 32 characters |

For `https://YOUR-NAME.github.io/YOUR-REPO/`, use that full value for `FRONTEND_URL` and `https://YOUR-NAME.github.io` for `ALLOWED_ORIGINS`. Add the Vercel origin if you also use its frontend. Select the appropriate deployment environment and redeploy after changing variables.

The frontend calls the public Vercel origin's `/api/...` routes. Private keys stay in Vercel. Backend validation, length limits, spam checks, and CORS apply to submissions. Management actions additionally require authentication; CORS alone is not authentication.

## Upstash is optional

Upstash Redis is a hosted database. Here it provides durable order storage, shared rate-limit counters, shared Minecraft caching, and atomic order decisions across serverless instances.

You may leave **both** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` empty. Without Redis:

- Donations still create Stripe Checkout Sessions.
- Private Discord messages store orders and their statuses.
- Customers receive encrypted, unpredictable tracking tokens. Public lookup returns only their request ID, status, and submission date.
- Minecraft uses temporary instance caching and CDN cache headers.
- Rate limits apply per instance and reset when it restarts; they are not shared protection. Optional Vercel firewall rules can add deployment-level protection.
- Review orders one at a time. Discord-only decisions cannot be guaranteed atomic across different instances.

Tracking expires after 90 days. Discord messages remain until manually deleted; deleting a message removes its tracking record. Keep `ORDER_ADMIN_KEY` stable: rotating it invalidates existing Discord-only tracking tokens. To enable Redis later, provide both optional variables. A configured Redis outage fails closed rather than silently switching storage modes.

## Stripe

1. Create a Stripe account and open Dashboard API keys in test mode.
2. Put the secret key (`sk_test_...`) only in Vercel's `STRIPE_SECRET_KEY`. A publishable key (`pk_...`) may be public, but this hosted redirect integration does not need it.
3. Configure the frontend URL and allowed origins, then redeploy.
4. Choose a preset or custom USD donation and continue to Stripe. The backend validates $1–$10,000 and creates a one-time Checkout Session. Stripe collects card details.
5. Test on Stripe's hosted page using `4242 4242 4242 4242`, a future expiry, and a test CVC. Confirm the transaction in the Stripe Dashboard; also test cancel and invalid amounts.
6. Activate your Stripe account, replace the test secret with the live secret (`sk_live_...`) in Vercel, and redeploy. Verify production URLs before a real donation.

Success/cancel URLs are `FRONTEND_URL` plus `success.html` and `cancel.html`. Opening the success page alone does not prove payment; Stripe's Dashboard is the payment record. No Stripe webhook is used because donations trigger no automatic fulfillment. Add a signature-verified webhook before adding payment-dependent fulfillment or accounting automation.

## Discord orders and Accept/Deny

Create a webhook in a private channel under channel Settings → Integrations → Webhooks. Put its URL only in Vercel's `DISCORD_ORDER_WEBHOOK_URL`. Set the long random `ORDER_ADMIN_KEY` and redeploy. Submit a test request with at least one email, Discord, or PulsedConnect contact.

The API creates a professional embed with a `KURO-...` ID, service, description, requirements, contacts, budget, deadline, timestamp, and status. The order form collects no payment details.

This implementation chooses **authenticated management links**, rather than Discord bot buttons. Open the embed's private management link, enter your management key, load the request, then Accept or Deny. The backend authenticates every action. The key is neither included in links nor persistently saved in the browser. No bot, application public key, or interactions endpoint is needed for this approach.

In Discord-only mode, the review link includes the message ID. If updating that link failed, enable Discord Developer Mode, copy the message ID, and enter it in the management form. Review one at a time without Redis. Optional Redis retains the shared atomic decision mechanism.

## Minecraft status

The backend uses `https://api.mcstatus.io/v2/status/java/ADDRESS` from MCStatus.io; no API key is required. Addresses are allowlisted in `api/mc-status.js`. Edit that list and the matching server cards in `scripts/generate.mjs` to add or remove servers, then rebuild.

Browser and backend caching lasts about five minutes. Without Redis, backend caches are local to an instance, supplemented by CDN headers and duplicate-request handling. With Redis, caching is shared. Offline servers and failed API calls display useful fallback states.

## Editing and production checks

Page content comes from `scripts/generate.mjs`; edit it rather than generated HTML. CSS is in `css/`, browser JavaScript in `js/`, and supplied avatar/screenshots in `assets/images/`. Run `npm run build` to regenerate pages and static output.

Before publishing, check mobile navigation, contact copying, request validation, a real Discord submission and authenticated decision, private tracking, Stripe test checkout, and Minecraft fallbacks. Live integration checks require your credentials and a configured backend; mocked tests cannot establish that production credentials work.
