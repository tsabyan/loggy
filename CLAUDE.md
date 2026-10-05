# Loggy — agent rules

Loggy is a single-user, chat-first project manager. Chat is the only input; a kanban board, timeline and stats are the output. The AI turns messages into JSON actions; the server validates and applies them.

## Read first, every session

1. `docs/TASKS.md` — pick the first unchecked task whose **Needs** are done (or the task the user names). Work on that one task only.
2. `docs/ARCHITECTURE.md` — the sections the task touches. Follow it; do not invent a different structure.
3. `docs/PRD.md` is product truth (FR-x ids in tasks point there). If a task conflicts with it or with ARCHITECTURE, stop and ask.

## Workflow for a task

1. Restate the task's **Done when** lines and list the files you will touch. Ask if anything is unclear.
2. For third-party APIs (Next.js, `@supabase/ssr`, `@google/genai`, Serwist, dnd-kit, Recharts, Zod), check current docs (context7) before writing code. Do not rely on memory for these.
3. Implement. Write tests alongside (unit for TS, SQL tests in `supabase/tests/` for DB functions and RLS).
4. Run `pnpm check` (and `supabase test db` if SQL changed). Fix until green.
5. Tick the task in `docs/TASKS.md`. Add a one-line note under it if anything differed from the plan. If you changed a design decision, update `docs/ARCHITECTURE.md` in the same change.
6. Commit with a Conventional Commit message that names the task, e.g. `feat(chat): confirmation card (T18)`.

Do not start the next task unless asked.

## Commands

```bash
pnpm dev            # Next.js dev server
pnpm check          # lint + typecheck + test (must pass before a task is done)
pnpm test           # Vitest
pnpm eval           # AI eval set against the real provider (Phase 2 gate)
pnpm db:types       # regenerate src/lib/db/types.ts from local Supabase
supabase start      # local Postgres, auth, realtime, mail inbox
supabase db reset   # re-apply all migrations + seed
supabase test db    # SQL tests in supabase/tests
```

## Hard rules

- **The AI never writes to the database.** It returns JSON matching `src/lib/ai/actions.ts`. The server validates with Zod and applies.
- **All data changes go through the `apply_actions` Postgres function** — chat, manual board edits (`source='manual'`) and undo. Never `insert`/`update`/`delete` on `projects` or `tasks` from TypeScript. This keeps `activity_log` complete.
- **Invalid AI output writes nothing.** Show a retry option instead.
- **Numbers come from SQL.** Stats, counts and recap rows are queried; the AI only phrases the summary.
- **Minimal AI context.** Active projects, ≤100 open tasks (id, title, project_id), last 5 messages, today's date. Never send completed tasks or history. Respect private workspaces.
- **One schema source.** The Zod schema in `actions.ts` generates the JSON Schema sent to the model. Do not hand-write a second copy.
- **Model id and provider come from env** (`AI_PROVIDER`, `AI_MODEL`). Never hardcode a model name.
- **RLS on every table**, `user_id` on every row. Use the user's session client. Never use the service-role key in app code.
- **Secrets stay server-side.** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` may be public. Never commit `.env.local`.
- **Migrations are append-only.** Never edit a migration that has been applied; add a new numbered file.
- **Tests never call a real AI.** Use `AI_PROVIDER=mock`. Only `pnpm eval` hits the real provider.
- **No new dependency** beyond ARCHITECTURE §2 without saying why and asking.
- **Stay in scope.** No voice, GitHub sync, scheduled summaries, teams or subtasks (PRD "Out of scope").

## Code conventions

- TypeScript strict. No `any`; use `unknown` + Zod at boundaries (AI output, request bodies, RPC results).
- Server Components by default. `"use client"` only for interactive parts (chat input, board drag, charts, realtime hook).
- Mutations from the UI use route handlers (`/api/chat`, `/api/undo`) or server actions that call `apply_actions`.
- Files: kebab-case. Components: PascalCase exports. One component per file in `src/components/<area>/`.
- UI from shadcn/ui primitives + Tailwind. No other component library.
- Dates: store `timestamptz` / `date`; format and group in `APP_TIMEZONE`.
- Keep functions small and named for what they do. Comment only the why.

## Definition of done

Every **Done when** line in the task is true · `pnpm check` passes · SQL tests pass if SQL changed · task ticked in `docs/TASKS.md` · ARCHITECTURE updated if a decision changed · no secrets in the diff.
