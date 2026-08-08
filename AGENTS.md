<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Configured via `.cursor/environment.json`. Commands live in `package.json` — prefer `npm run …` over inlining CLI strings.

### Boot sequence

1. **Install** (automatic): `npm run setup:agent` — `npm ci` + anonymous Convex once (writes `.env.local`).
2. **Terminals** (automatic):
   - `npm run dev:convex` — keeps the local backend running
   - `npm run dev:web:ready` — waits for Convex on `:3210`, then Next on `:3000`

### Development rules

- Use anonymous / local Convex for Cloud Agents (`CONVEX_AGENT_MODE=anonymous`). Do **not** log into the human owner's personal Convex deploy.
- Never run `npx convex deploy` unless explicitly asked to deploy production.
- Do not commit `.env.local` or anything under `.convex/`.
- UI design tokens live in `DESIGN.md` — follow them for product UI work.
- Read Next.js docs under `node_modules/next/dist/docs/` before changing App Router / Next APIs.
- **Browser validation:** always use **Cursor Browser** (`cursor-ide-browser` MCP: navigate, snapshot, screenshot, click, type). Never use Playwright, `playwright-cli`, or other external browser automation for UI checks in this repo.

### Auth configuration (per Convex deployment)

GitHub sign-in uses Convex Auth. Credentials must live on the **Convex deployment** (dashboard / `npx convex env set`), not only in Vercel Next.js env. Missing `AUTH_GITHUB_ID` produces a GitHub URL with `client_id=undefined`.

Required on each Convex deployment:

- `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` — GitHub OAuth app credentials  
  Callback URL: `https://<deployment>.convex.site/api/auth/callback/github`  
  Production deployment: `different-anaconda-22` →  
  `https://different-anaconda-22.convex.site/api/auth/callback/github`
- `JWT_PRIVATE_KEY` and `JWKS` — RSA key pair for Convex Auth tokens
- `SITE_URL` — app origin for OAuth return (e.g. `https://collaborative-docs-bice.vercel.app`)

Automation:

- `npm run convex:auth-env` — ensures JWT keys + `SITE_URL`; copies `AUTH_GITHUB_*` from the process env when present
- `npm run setup:agent` — runs that after anonymous Convex init
- Production Vercel builds (`scripts/build.mjs`) run the same sync when `CONVEX_DEPLOY_KEY` is set. Put `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET` (and optionally `SITE_URL`) in **Vercel Production** env so they are pushed to Convex on deploy.

Until `AUTH_GITHUB_*` are set, the sign-in page disables “Continue with GitHub” and explains that auth is unconfigured.

### Useful commands

```bash
npm run lint
npm run build
npm run convex:once          # refresh functions / .env.local once
npm run dev:convex           # long-running local Convex
npm run dev:web              # Next only (assumes Convex already up)
npm run dev:web:ready        # wait for Convex, then Next
```

### Product vs repo agents

- **Repo Cloud Agents** (this environment): develop CollaborativeDocs itself.
- **Doc invite agents** (product feature): Share dialog → mint token → `curl …/api/join/{token} | sh` configures MCP for a Cursor CLI agent inside a document. That path needs a publicly reachable app origin; local Cloud Agent VMs are for codebase work, not dogfooding invites unless you tunnel/deploy.
