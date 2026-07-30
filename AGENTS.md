<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

This repo is configured for Cursor Cloud Agents via `.cursor/environment.json`.

### Boot sequence

1. **Install** (automatic): `npm ci`, then `CONVEX_AGENT_MODE=anonymous npx convex dev --once` — provisions an isolated local Convex backend and writes `.env.local` (`NEXT_PUBLIC_CONVEX_URL`, etc.).
2. **Terminals** (automatic):
   - `convex` — keeps the local backend running and syncs functions
   - `next` — app on `http://localhost:3000`

### Development rules

- Use `CONVEX_AGENT_MODE=anonymous` / local Convex for Cloud Agents. Do **not** log into the human owner's personal Convex deploy.
- Never run `npx convex deploy` unless explicitly asked to deploy production.
- Do not commit `.env.local` or anything under `.convex/`.
- UI design tokens live in `DESIGN.md` — follow them for product UI work.
- Read Next.js docs under `node_modules/next/dist/docs/` before changing App Router / Next APIs.

### Useful commands

```bash
npm run lint
npm run build
CONVEX_AGENT_MODE=anonymous npx convex dev --once   # refresh functions once
npm run dev -- --hostname 0.0.0.0 --port 3000       # app only
```

### Product vs repo agents

- **Repo Cloud Agents** (this environment): develop CollaborativeDocs itself.
- **Doc invite agents** (product feature): Share dialog → mint token → `curl …/api/join/{token} | sh` configures MCP for a Cursor CLI agent inside a document. That path needs a publicly reachable app origin; local Cloud Agent VMs are for codebase work, not dogfooding invites unless you tunnel/deploy.
