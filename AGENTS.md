<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:supabase-env-rules -->
# Supabase: Test Project Only — Never Touch Production

There are TWO Supabase projects:

| Project | Ref ID | Use |
|---------|--------|-----|
| inspection-checklist-test | `cnqotgwqqxiqforchuux` | **All development and testing — use this** |
| inspection-checklist (production) | `quuqxbvzxgaatbfuvyum` | **NEVER modify during development** |

**MANDATORY RULE:** All database changes (schema migrations, RLS policies, seed data, DDL) MUST be applied to the TEST project only (`cnqotgwqqxiqforchuux`).

**DO NOT** run any SQL or Supabase MCP commands against the production project (`quuqxbvzxgaatbfuvyum`) unless explicitly instructed by the user with "apply to production".

**Before any Supabase MCP or CLI operation:**
1. Confirm the target `project_id` is `cnqotgwqqxiqforchuux` (test), not `quuqxbvzxgaatbfuvyum` (production)
2. If you must temporarily link via CLI: `npx supabase link --project-ref cnqotgwqqxiqforchuux`
3. After any DB operation, document it in `.planning/PRODUCTION-DEPLOY.md` under the appropriate phase section — include the SQL, the purpose, and mark status as "✅ Test | ⏳ Production"

**Production deployment is a separate manual process** — see `.planning/PRODUCTION-DEPLOY.md` for the full checklist.
<!-- END:supabase-env-rules -->
