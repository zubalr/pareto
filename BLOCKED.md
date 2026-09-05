# Human Gate 1: Cloudflare Authentication Required

## Status
The local implementation, schema, migrations, seed script, metrics module, golden unit tests, TanStack Start application, and client-only ECharts bundle are 100% complete, fully verified, and tested locally.

However, remote operations (creating the Cloudflare D1 database, creating the KV namespace, and deploying to `*.workers.dev`) require Cloudflare account credentials.

Per specification:
> "1. `wrangler whoami` is not authenticated. Human runs `wrangler login` on Homebase (or pastes an API token). You never invent account IDs."
> "If any of these fail after you have tried the local fix, write `BLOCKED.md` with the exact command the human must run, then stop."

---

## Action Required by Human

Run this command in a terminal on Homebase:

```bash
cd /home/wertyp/Code/Personal/pareto && npx wrangler login
```

*(Alternatively, export your API token in your shell environment):*
```bash
export CLOUDFLARE_API_TOKEN="<your-cloudflare-api-token>"
```

---

## Resume Commands (Automated or Human)

Once authenticated, run:

```bash
cd /home/wertyp/Code/Personal/pareto

# 1. Create Remote D1 Database
npx wrangler d1 create pareto-catalog
# (Note the returned database_id and paste into wrangler.jsonc under d1_databases[0].database_id)

# 2. Create Remote KV Namespace
npx wrangler kv namespace create pareto-frontier
# (Note the returned id and paste into wrangler.jsonc under kv_namespaces[0].id)

# 3. Apply Migrations to Remote D1
npx wrangler d1 migrations apply DB --remote

# 4. Seed Remote D1 Database
npx wrangler d1 execute DB --remote --file=scripts/seed.sql

# 5. Build and Deploy to Cloudflare Workers
pnpm deploy
```
