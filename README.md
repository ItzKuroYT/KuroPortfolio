# Kuro's Portfolio

A complete portfolio built with static HTML, CSS, and vanilla JavaScript. GitHub Pages serves the frontend, and Vercel serves the private API. No framework or runtime frontend build dependency is required. The design uses ink blue, editorial typography, restrained motion, Kuro's actual project screenshots, and the supplied Discord profile picture.

## Run it locally

Install Node.js 22 or newer. In this folder:

```powershell
npm.cmd install
npm.cmd run dev
```

Open **http://localhost:3000**. On macOS/Linux, use `npm` instead of `npm.cmd`. The site and navigation work immediately. Donations and order submissions require the configuration below; they show a useful error until configured. For local integration checks, copy `.env.example` to `.env`, fill it privately, and set `ALLOWED_ORIGINS=http://localhost:3000` and `FRONTEND_URL=http://localhost:3000/`. Restart the dev server after changing `.env`.

The browser never receives `.env`. The local server serves an explicit allowlist of public files.

## What is included

- Home, About, Web Development, Minecraft Development, Voice Acting, Projects, Donate, Order, and Contact pages.
- All supplied project URLs; JJS Libraries is labeled **Legacy / Very Old Project**. PulsedMC and PulsedConnect are presented as collaborations. G.R.A.S.S is labeled **Upcoming / Not Released**.
- All six supplied website screenshots, with a keyboard-accessible full-size viewer. The final screenshot is used for MineStore, as requested. Technologies are not guessed.
- Discord profile image, mobile navigation, visible keyboard focus, reduced-motion support, scroll reveals, responsive cards, and a click-to-load YouTube preview.
- Customer testimonials area: **None currently.**
- Preset and custom USD donations with Stripe-hosted Checkout, $1 minimum, $10,000 maximum, loading states, error handling, and return pages.
- Service-specific request forms requiring at least one email, Discord, or PulsedConnect contact method.
- Private Discord order embeds, durable Redis storage, authenticated Accept/Deny management, and private customer tracking.
- Five-minute cached MCStatus data with independent failure states and copyable server addresses.
- Metadata, favicon, social preview image, privacy information, 404 page, and optional absolute canonical URLs and sitemap.

## 1. GitHub setup

1. Create a GitHub repository, for example `KuroPortfolio`. Do not add `.env`, private credentials, `node_modules`, or test artifacts. The supplied `.gitignore` excludes these.
2. Commit the project source, including `.github`, `api`, `lib`, `scripts`, HTML pages, CSS, JavaScript, assets, `package.json`, and `package-lock.json`. Backend code is safe to keep public; its credentials only exist in Vercel environment variables.
3. If starting with a new empty repository:

```powershell
git init
git add .
git commit -m "Build Kuro's Portfolio"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/KuroPortfolio.git
git push -u origin main
```

4. In **Settings → Pages → Build and deployment**, select **GitHub Actions**. The included `pages.yml` workflow generates the pages, builds a safe `dist/` directory, and deploys it. Only static frontend files are published; APIs, tools, `.env`, and dependencies are excluded. This follows the [GitHub Pages custom workflow model](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
5. The project frontend URL will usually be `https://YOUR_USERNAME.github.io/KuroPortfolio/`. The trailing slash and repository path matter for Stripe return URLs. Static navigation and assets use relative URLs to support this path.
6. Set the public backend origin in `js/config.js` once Vercel is deployed:

```js
export const API_BASE_URL = 'https://YOUR_BACKEND.vercel.app';
```

7. For production canonical metadata and sitemap, add a non-secret repository variable named `SITE_URL` under **Settings → Secrets and variables → Actions → Variables**, with the complete frontend URL ending in `/`. The workflow passes it to the generator. For local builds, set `$env:SITE_URL='https://YOUR_USERNAME.github.io/KuroPortfolio/'` before `npm.cmd run build`.
8. Push future updates with `git add .`, `git commit -m "Describe the update"`, and `git push`. GitHub Pages and the connected Vercel project redeploy on pushes to `main`.

To use a custom domain, add it in GitHub Pages settings, configure your DNS records for GitHub Pages, and enable HTTPS. Follow [GitHub's custom-domain instructions](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site) for the correct records and domain verification. Update `SITE_URL`, `FRONTEND_URL`, and `ALLOWED_ORIGINS` to the new domain and redeploy both services. You may keep both old and new frontend origins in the allowlist during migration.

You can also publish the built contents of `dist/` from a dedicated branch. Do not publish the entire source tree as a Pages artifact; the supplied workflow already handles this correctly.

## 2. Vercel and Redis setup

1. Sign into Vercel, choose **Add New → Project**, and import the same GitHub repository. Use the repository root, Framework Preset **Other**, Node.js 22+, Build Command `npm run build`, and Output Directory `dist`. `vercel.json` supplies these settings.
2. The root `api/*.js` files become Node.js serverless functions. Shared code lives under `lib/`, outside the route directory. See [Vercel's Node.js function documentation](https://vercel.com/docs/functions/runtimes/node-js).
3. Create an **Upstash Redis** database, either directly or through Vercel Marketplace. Copy its REST URL and **read/write** REST token into Vercel environment variables. Use a database with durable storage and adequate capacity; avoid an eviction policy that silently removes orders. The [Upstash REST documentation](https://upstash.com/docs/redis/features/restapi) describes its HTTP command API.
4. Add these environment variables to the Vercel project:

| Variable | Value / purpose |
| --- | --- |
| `STRIPE_SECRET_KEY` | Stripe secret key, initially a test key |
| `DISCORD_ORDER_WEBHOOK_URL` | Private webhook copied from your Discord server |
| `ORDER_ADMIN_KEY` | A random management password of at least 32 characters |
| `UPSTASH_REDIS_REST_URL` | Your database's HTTPS REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Your database's read/write REST token |
| `FRONTEND_URL` | Full frontend base URL, including any GitHub repository path, ending in `/` |
| `ALLOWED_ORIGINS` | Comma-separated permitted frontend origins; no paths or trailing slash |

Example **public URL values**:

```text
FRONTEND_URL=https://YOUR_USERNAME.github.io/KuroPortfolio/
ALLOWED_ORIGINS=https://YOUR_USERNAME.github.io
```

For a custom domain:

```text
FRONTEND_URL=https://portfolio.example.com/
ALLOWED_ORIGINS=https://portfolio.example.com
```

5. Generate the management key locally, then paste it privately into Vercel and your password manager:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Never commit this generated value. Only Kuro or another trusted reviewer should have it. Anyone who knows the key can review and decide orders. Rotate it in Vercel and redeploy if it is shared accidentally.

6. Deploy, set `API_BASE_URL` in `js/config.js`, and push that public change. Only the Vercel origin belongs in frontend config. Private values must remain in Vercel.
7. Environment changes require a new deployment. Configure Production separately from Preview. If testing a preview frontend, add its exact origin to `ALLOWED_ORIGINS`; do not use wildcard CORS.

The browser sends JSON to `https://YOUR_BACKEND.vercel.app/api/...`. The API uses Stripe, Discord, and Redis privately and returns only the result needed by the browser. It never accepts frontend-supplied Stripe return URLs, arbitrary webhook URLs, or arbitrary Minecraft hosts.

### API routes

| Route | Method | Use |
| --- | --- | --- |
| `/api/create-checkout-session` | POST | Validates USD amount and creates Stripe Checkout |
| `/api/submit-order` | POST | Validates request, stores it, sends Discord embed |
| `/api/order-status` | POST | Returns status only with ID + private token |
| `/api/manage-order` | POST | Requires management key; reviews and changes status |
| `/api/mc-status?address=...` | GET | Retrieves allowlisted, cached Minecraft status |

Write routes require a configured browser origin. Redis is required for order storage and distributed rate limits. Writes fail closed if Redis is unavailable. Limits: 4 order submissions per 15 minutes, 8 checkout sessions per 10 minutes, 30 status checks per 10 minutes, and 20 management requests per 10 minutes per network address. Rate records use a hashed network address, never the raw address, and expire automatically. These fixed-window limits and the honeypot/timing checks are basic protection; configure Vercel Firewall rules if abuse becomes a concern.

## 3. Stripe setup

1. Create a Stripe account and complete the account activation steps needed to accept payments. Start in a sandbox/test environment.
2. In Stripe Dashboard, find **Developers → API keys** (or search for API keys in the dashboard). `pk_test_...` / `pk_live_...` keys are publishable; `sk_test_...` / `sk_live_...` keys are private. This integration redirects directly to a server-created Checkout URL, so it **does not need a publishable key** in the frontend.
3. Put the **test secret key** in `STRIPE_SECRET_KEY` in Vercel, then redeploy. Never put it in HTML, frontend JavaScript, GitHub Actions variables, or the repository.
4. The backend validates the amount, converts it to integer cents, sets `usd`, and calls [Stripe's Checkout Sessions API](https://docs.stripe.com/api/checkout/sessions/create). It creates a one-time donation line item. No Price ID or Product setup is required beforehand.
5. Stripe redirects back to `FRONTEND_URL + success.html` or `FRONTEND_URL + cancel.html`. This preserves your GitHub repository path. The success page says you returned from Checkout; it does not claim to verify a payment merely because someone opened that URL.
6. Test a preset amount and a custom amount on your deployed frontend. On **Stripe's hosted payment page only**, use test card `4242 4242 4242 4242`, a future expiry, and any three-digit CVC. Check the resulting payment in Stripe Dashboard. Test declined payments and cancellation using [Stripe's testing guidance](https://docs.stripe.com/testing). No real funds move in a test environment.
7. Test invalid values, below-minimum values, and network failures. The frontend and server both validate amounts.
8. To accept live donations, finish Stripe activation, replace the Vercel test secret with the live secret key, and redeploy. Confirm your production URLs and account settings first. Never use live card details to test the sandbox.

No Stripe webhook is used here because the site does not fulfill goods, grant access, or maintain payment balances. Stripe Dashboard and receipts are the authority for final payment status. If you later add fulfillment or a payment-verified receipt page, add a signed Stripe webhook and process `checkout.session.completed` / relevant async events server-side before taking action. No unused `STRIPE_WEBHOOK_SECRET` is included in `.env.example`.

## 4. Discord setup and Accept/Deny

1. Choose a private channel in your Discord server for orders. Restrict channel access to you and trusted reviewers.
2. Open **Channel Settings → Integrations → Webhooks → New Webhook**. Copy the webhook URL.
3. Put it in **Vercel's** `DISCORD_ORDER_WEBHOOK_URL`, never in frontend files. Use the `https://discord.com/api/webhooks/...` URL format. Redeploy.
4. Submit a request from the portfolio. The backend sends a professional embed including the order ID, service, contact methods, budget, deadline, description, requirements, additional fields, and timestamp. Customer text is treated as plain data, mentions are disabled, and Markdown is escaped. Payment information is not collected by the order form.
5. Each embed includes a **Review · Accept · Deny** management link. Open it, enter your private `ORDER_ADMIN_KEY`, and authenticate to see the request. Then use Accept or Deny. The API authenticates every review/change, persists the decision atomically in Redis, and edits the Discord embed to show the new status.
6. If the Discord edit fails, the stored status remains correct. The management page reports this and an authenticated review retries the edit. Repeated or concurrent decisions cannot overwrite an existing decision.

**Chosen implementation:** authenticated management links, the simpler secure fallback in your brief. An ordinary Discord webhook cannot receive secure button interactions by itself. There are no public unauthenticated decision URLs, and the link never includes a management credential. A bot, Discord application ID, public key, bot token, and interaction endpoint are not required for this implementation. See [Discord's webhook documentation](https://docs.discord.com/developers/resources/webhook).

The key is held only in the management form's memory while the page is open and sent over HTTPS in an Authorization header. It is not saved in local/session storage. Always open the management page on your actual portfolio domain. Never paste the key into another website or a public message.

Requests receive unpredictable IDs like `KURO-0123456789ABCDEF`. Customers also receive a random 256-bit tracking token. Only a token hash is stored with the order. Tracking returns no description or customer contacts. On GitHub Pages use `order-status.html` (or `/KuroPortfolio/order-status` where extensionless resolution is available); direct root `/order-status` is for root-domain hosting. A private request fragment keeps the token out of query strings and server logs, then removes it from the address bar. Save both ID and token before closing the browser tab.

Requests expire from Redis after 90 days. Discord messages must be deleted separately when no longer needed. If an upstream request times out, delivery can be ambiguous; contact Kuro before retrying a request that might already have arrived. The app avoids asking the customer to retry when it knows Discord already received the message but tracking could not be finalized.

## 5. MCStatus setup

The portfolio uses [MCStatus.io's Java Edition API](https://mcstatus.io/docs):

```text
https://api.mcstatus.io/v2/status/java/<address>?query=false
```

No API key is required. The Vercel proxy allows only the six portfolio addresses. Results and failure states are cached in Redis for five minutes. A distributed lock prevents simultaneous cold instances from making duplicate checks for the same server. Browser storage caches results for five minutes too. Browser requests are sequential; cards are not continuously polled. Status includes online/offline, player count/capacity, version, plain-text MOTD, and a PNG icon when available. API failure is labeled **Status unavailable**, not **Offline**.

To add/remove/change servers, update both:

- `servers` in `scripts/generate.mjs` (page cards)
- `servers` in `api/mc-status.js` (backend allowlist)

Run `npm run build`, commit, and push. Server availability and third-party API restrictions are outside this site's control. You can always copy the address even when status is unavailable.

## Edit the portfolio

HTML files are generated and committed so the frontend works as ordinary static files. Edit `scripts/generate.mjs` for content/layout and shared markup; edit CSS/JS directly for styling/behavior. Run `npm run generate` or `npm run build` after content changes. Editing generated HTML alone is temporary because the next build regenerates it.

- `css/main.css`: responsive layout and styles
- `css/personal.css`: personal layout, project screenshots, and quieter visual styling
- `css/profile.css`: Discord profile identity styles
- `css/animations.css`: motion and reduced-motion behavior
- `js/config.js`: public Vercel origin only
- `js/order.js`, `js/donate.js`, `js/tracking.js`: customer interactions
- `lib/backend.js`: private validation, Redis, authorization, and rate limiting
- `lib/discord.js`: embed formatting and webhook calls
- `assets/images/discord-avatar.png`: your exact supplied Discord profile picture
- `assets/images/projects/`: your six original screenshots; filenames match each project
- `assets/images/social.png`: bundled social preview; regenerate with `node scripts/visual-check.mjs` while the local server runs if its source SVG changes

YouTube is embedded using its privacy-enhanced player only after a user clicks to load it. No copyrighted video content was downloaded.

## Checks and launch verification

```powershell
npm.cmd test
npm.cmd run test:browser
npm.cmd run build
```

Browser checks use an installed Google Chrome. To use Edge, set `$env:PLAYWRIGHT_CHANNEL='msedge'`. You can instead install Playwright's Chromium browser and adjust `playwright.config.js` to omit the channel option. Tests verify API validation, cents/currency, CORS, webhook success/failure, auth, atomic decisions, private tracking, rate limits, cache/fallback, navigation, dynamic forms, mobile layout, and reduced motion. API tests simulate Stripe, Discord, MCStatus, and Redis; browser tests simulate API responses for interactive flows. They do not send live payments or Discord messages.

Before announcing the site, run these checks on **the real GitHub Pages frontend using the separate Vercel backend**:

1. Open every navigation link on desktop and mobile. Use keyboard Tab and Escape for the mobile menu.
2. Visit project links. Some supplied sites may be unavailable or restricted; the portfolio preserves your exact URLs and does not claim they are all currently online.
3. Submit one request for each service using a test contact. Check the Discord embeds and order IDs.
4. Check status with the correct token; confirm a wrong token reveals nothing.
5. Authenticate, accept one request, deny another, and check the Discord edits and customer tracking status.
6. Create a test Stripe donation with both a preset and a custom amount. Confirm success, cancellation, and payment status in Stripe Dashboard.
7. Verify Minecraft fallback when upstream data is unavailable.
8. Check Vercel environment settings, CORS origin, and return URLs. Look at the published `dist` artifact to confirm it contains only public HTML/CSS/JS/assets.

Live Stripe/Discord/Redis integration requires your own account configuration. The source is ready for that configuration; it is not already deployed or connected to your accounts.
