# Loggy — Build Tasks

Do tasks top to bottom: 37 tasks in 4 phases, each sized for one vibe-code session. A phase starts only after the previous gate passes.

How to use this file:

- Pick the first unchecked task whose **Needs** are all checked. One task per session.
- Paste the task into the agent, or say "do T07". The agent reads `CLAUDE.md` and `docs/ARCHITECTURE.md` first.
- A task is done when every **Done when** line is true and `pnpm check` passes. Then tick the box and add a one-line note under it if something changed from the plan.
- Found missing work? Add a task with the next free number (e.g. `T12a`) in the right place. Never renumber.

Legend: **FR** = PRD functional requirement. **Needs** = tasks that must be done first.

---

## Phase 1 — Foundation (est. 1 week)

Gate: magic-link login works, schema and RLS are live, both workspaces are seeded, and the app is deployed.

- [x] **T01 Scaffold the app**
      Needs: —
      Do: `create-next-app` with TypeScript, App Router, Tailwind, ESLint, `src/` dir, pnpm. The repo is not empty (`CLAUDE.md`, `docs/`, `.gitignore`), so scaffold into a temp folder and move the files in; keep the existing `.gitignore` (merge, don't overwrite). Init shadcn/ui. Add Vitest + Prettier. Add scripts `typecheck`, `test`, `format`, and `check` (= lint + typecheck + test). Add `.env.example` (all names from ARCHITECTURE §9, empty values). Git and the `origin` remote are already set up.
      Done when: `pnpm dev` shows a placeholder page; `pnpm check` passes.
      Note: Next 16.3, shadcn Radix base + Nova preset (uses shadcn's `cn` package), Vitest 5 (node env default, jsdom per file). `check` also runs `format:check`. Kept Next's generated `AGENTS.md`, imported from `CLAUDE.md`.

- [ ] **T02 Supabase local + clients**
      Needs: T01
      Do: Add Supabase CLI as dev dep, `supabase init`, `supabase start`. Create `src/lib/supabase/client.ts` (browser) and `server.ts` (server components, route handlers, server actions) with `@supabase/ssr`. Add `pnpm db:types` script that writes `src/lib/db/types.ts`.
      Done when: a server component can query `select 1` style health check against local Supabase; README section "Local dev" lists the start commands.

- [ ] **T03 Migration: schema**
      Needs: T02
      Do: `supabase/migrations/0001_schema.sql` with enums, the five tables, columns, FKs, unique `(user_id, lower(name))` on projects, indexes, and `updated_at` triggers, exactly as ARCHITECTURE §5.
      Done when: `supabase db reset` runs clean; `pnpm db:types` generates types for all five tables.

- [ ] **T04 Migration: RLS + realtime**
      Needs: T03
      Do: `0002_rls.sql`: enable RLS on all tables, owner-only policies for select/insert/update/delete, add `projects`, `tasks`, `activity_log`, `chat_messages` to the `supabase_realtime` publication. Write `supabase/tests/rls.sql` that proves user B cannot read or write user A's rows.
      Done when: RLS test passes (`supabase test db`).

- [ ] **T05 Seed workspaces on signup**
      Needs: T03
      Do: `0003_seed_trigger.sql`: trigger on `auth.users` insert creates `Office` and `Personal` workspaces for the new user.
      Done when: creating a user in local Studio produces exactly two workspaces for that user.

- [ ] **T06 Auth: magic link + guard**
      Needs: T02, T05
      Do: `/login` page (email field, send link), `/auth/callback` route, `src/proxy.ts` session refresh + redirect to `/login`, sign-out button. Reject emails that are not `ALLOWED_EMAIL` with a generic message.
      Done when: log in via Inbucket/Mailpit locally, land on `/`, refresh keeps the session, sign-out returns to `/login`, another email is refused.

- [ ] **T07 Typed read helpers**
      Needs: T03
      Do: `src/lib/db/queries.ts`: `getWorkspaces`, `listActiveProjects`, `listOpenTasks(limit)`, `listRecentMessages(n)`. All take a Supabase client, all typed from `types.ts`.
      Done when: unit tests with a seeded local DB return expected rows.

- [ ] **T08 Deploy skeleton**
      Needs: T06
      Do: create Supabase cloud project, `supabase db push`, set auth Site URL + redirect URLs, disable open sign-ups. Create Vercel project, set env vars, deploy.
      Done when: login works on the Vercel URL from your phone.

**Gate 1:** [ ] login works on prod · [ ] RLS test passes · [ ] two workspaces exist for you.

---

## Phase 2 — AI chat (est. 2 weeks)

Gate: 20 test messages in `evals/messages.jsonl` parse to the expected actions, and every change has a card with working undo.

- [ ] **T09 Action schema**
      Needs: T01 · FR-1, FR-2, FR-3
      Do: `src/lib/ai/actions.ts`: Zod discriminated union for all 10 action types, `ParseResultSchema = { actions, reply }`, the `superRefine` rules from ARCHITECTURE §6, and `actionJsonSchema` exported via `z.toJSONSchema`.
      Done when: unit tests cover one valid and one invalid case per type, plus each rule (query alone, clarify alone, `project_ref` resolution, max 10).

- [ ] **T10 AIProvider + mock**
      Needs: T09
      Do: `provider.ts` interface + `getProvider()` from `AI_PROVIDER`. `providers/mock.ts` returns canned results keyed by message text (for tests and offline UI work).
      Done when: `AI_PROVIDER=mock` returns a canned parse; unknown provider throws a clear error at startup.

- [ ] **T11 Context builder**
      Needs: T07, T09
      Do: `src/lib/ai/context.ts` builds `AIContext` per ARCHITECTURE §4 step 3, including private-workspace redaction and `APP_TIMEZONE` date. Add a token estimate helper and log a warning above 2,500.
      Done when: unit test with fixture data checks: cap of 100 tasks, no completed tasks, private titles cut to 40 chars, no notes sent.

- [ ] **T12 System prompt + Gemini adapter**
      Needs: T10, T11
      Do: `prompt.ts` (static, `PROMPT_VERSION`). `providers/gemini.ts` with `@google/genai`: JSON output with `actionJsonSchema`, minimum thinking, low temperature, 10 s timeout, 2 retries with backoff on 429/5xx. Check current SDK docs first.
      Done when: a script `pnpm tsx scripts/try-ai.ts "finished login API for Alpha, next is tests"` prints valid parsed actions against fixture context.

- [ ] **T13 Migration: `apply_actions`**
      Needs: T04
      Do: `0004_apply_actions.sql` per ARCHITECTURE §5: one transaction, `project_ref` resolution, activity rows with `before`/`after`, `source` param, returns per-action results. `security invoker`.
      Done when: SQL tests cover each mutation type, a mixed message (complete 1 + create 2), a project+tasks via `project_ref`, and full rollback when one action fails.

- [ ] **T14 Executor**
      Needs: T09, T13
      Do: `src/lib/chat/executor.ts`: reject unknown ids before calling the RPC, call `apply_actions`, turn the result into a card summary (`{ done, added, updated, deleted, notes, items[] }`).
      Done when: unit tests with the mock client cover unknown-id rejection and summary counts.

- [ ] **T15 `/api/chat` route**
      Needs: T11, T12, T14
      Do: `src/lib/chat/handle-message.ts` + `app/api/chat/route.ts` implementing ARCHITECTURE §4 steps 1–8. Save `latency_ms`. Invalid JSON or AI failure writes nothing to projects/tasks and returns `retryable: true`.
      Done when: integration test (mock provider, local DB) covers mutation, clarify, invalid output, and AI timeout paths.

- [ ] **T16 Query path (recap + status)**
      Needs: T15 · FR-13
      Do: `src/lib/chat/query.ts`: SQL for `pending` (open tasks grouped by project), `completed` and `recap` (from `activity_log` in a date range), then `provider.summarize`. Add `activity_between` SQL function in `0005_query_fns.sql`.
      Done when: "what did I finish this week?" on seeded data returns a summary whose counts match SQL.

- [ ] **T17 Chat UI**
      Needs: T15 · FR-4
      Do: `components/chat/`: message list with history from `chat_messages` (load last 50, scroll up for more), pinned input, sending state, error bubble with Retry.
      Done when: send, see reply, reload page and history is still there; failed send shows Retry and retry works.

- [ ] **T18 Confirmation card**
      Needs: T17 · FR-5
      Do: `ActionCard` under each assistant message that changed data: one-line summary ("1 done, 2 added") + expandable list of items with project names.
      Done when: each mutation type renders a correct card from stored `chat_messages.result`.

- [ ] **T19 Undo**
      Needs: T13, T18 · FR-6
      Do: `0006_undo.sql` with `undo_message` per ARCHITECTURE §5 (incl. conflict check). `app/api/undo/route.ts`. Undo button on the card; card shows "Undone" after.
      Done when: SQL tests cover undo of create, update, complete, delete, a mixed message, double undo refused, and conflict refused; UI undo restores the list.

- [ ] **T20 Basic task list**
      Needs: T07, T17
      Do: temporary right-hand panel: open tasks grouped by project, with status. Refreshes after each chat reply.
      Done when: chat changes appear in the list after reply.

- [ ] **T21 Eval set + runner**
      Needs: T12
      Do: `evals/fixtures/context.json` (2 workspaces, ~6 projects, ~30 tasks). `evals/messages.jsonl`: 20+ real-style messages covering every use case in the PRD table, plus ambiguous ones that must `clarify`. `evals/run.ts` (`pnpm eval`) calls the real provider, compares action types and ids, prints pass/fail and token counts.
      Done when: `pnpm eval` runs and prints a score. Iterate on `prompt.ts` until the gate passes.

**Gate 2:** [ ] `pnpm eval` 20/20 · [ ] avg under 2,500 input / 300 output tokens · [ ] every mutation has a card and undo works · [ ] used for real for 3 days.

---

## Phase 3 — Views (est. 1–2 weeks)

Gate: board, timeline and stats all reflect chat changes correctly.

- [ ] **T22 App shell + filters**
      Needs: Gate 2 · FR-15 (desktop half)
      Do: `(app)/layout.tsx`: chat panel left, views right with tabs Board / Timeline / Stats. Workspace + project filter in URL search params, shared by all views. Remove T20 list.
      Done when: tabs switch without losing chat scroll; filters survive reload.

- [ ] **T23 Kanban board (read)**
      Needs: T22 · FR-7
      Do: To do / In progress / Done columns, cards show title, project, priority, due date. Archived projects hidden.
      Done when: board matches DB for seeded data with each filter combination.

- [ ] **T24 Task detail sheet**
      Needs: T23 · FR-8
      Do: click card → side sheet with notes, estimate, links, due date, and history from `activity_log` for that task.
      Done when: history shows chat and manual changes with timestamps in `APP_TIMEZONE`.

- [ ] **T25 Drag and drop + inline edit**
      Needs: T23, T13 · FR-9
      Do: dnd-kit between and within columns (updates `status`, `position`). Inline edit title/priority/due in the sheet. All writes go through a server action that calls `apply_actions` with `source='manual'`.
      Done when: drag persists after reload and appears in the timeline as a manual change.

- [ ] **T26 Archive project**
      Needs: T25 · FR-7
      Do: archive/unarchive in a project menu (manual only), via `apply_actions` `update_project`.
      Done when: archived project disappears from board and AI context, and can be restored.

- [ ] **T27 Timeline view**
      Needs: T22, T16 · FR-10
      Do: reverse-chronological log grouped by day, filter by project, each row says what changed (e.g. "Done: Login API · Alpha"). Paginate by day.
      Done when: every change from a test session shows once, in the right day group.

- [ ] **T28 Stats SQL**
      Needs: T04 · FR-11, FR-12
      Do: `0007_stats.sql`: `project_stats`, `tasks_done_per_week`.
      Done when: SQL tests check counts, completion rate, and estimated hours on fixture data.

- [ ] **T29 Stats UI**
      Needs: T22, T28 · FR-11
      Do: per-project table (open, done, completion %, est. hours open / done) + Recharts bar chart of tasks done per week.
      Done when: numbers match T28 test fixtures when seeded.

**Gate 3:** [ ] a 10-message chat session is correctly reflected in board, timeline and stats · [ ] views load under 1 s with 50 projects / 2,000 tasks seeded.

---

## Phase 4 — PWA + polish (est. 1 week)

Gate: you use it daily for one week.

- [ ] **T30 Realtime**
      Needs: Gate 3 · FR-17
      Do: `useLive` hook subscribing to `tasks`, `projects`, `activity_log`; all views refresh within 1 s. Remove manual refresh-after-reply from T20/T17 if any.
      Done when: change in one browser tab appears in another within 1 s.

- [ ] **T31 Mobile layout**
      Needs: T22 · FR-15
      Do: under 768 px: chat full screen, bottom tab bar to Board / Timeline / Stats, input pinned above keyboard, tap targets ≥ 44 px.
      Done when: every flow works one-handed on a phone.

- [ ] **T32 PWA**
      Needs: T31 · FR-16
      Do: `app/manifest.ts`, icons (192, 512, maskable), splash/theme colors, Serwist service worker (check current Serwist + Next docs), offline fallback page that says chat needs a connection.
      Done when: installable on Android Chrome and iOS Safari; Lighthouse PWA checks pass.

- [ ] **T33 Private workspace setting**
      Needs: T11, T22 · NFR Privacy
      Do: `/settings` page with a "private" toggle per workspace (`workspaces.is_private`).
      Done when: with Office private, the context sent to the AI contains only ids and short titles for Office tasks (assert in a test).

- [ ] **T34 Error + rate-limit polish**
      Needs: T15
      Do: friendly messages for 429, timeout and invalid output; disable send while pending; handle double-submit.
      Done when: forced failures (mock provider error modes) each show the right message and nothing is written.

- [ ] **T35 Metrics query**
      Needs: T19
      Do: `scripts/metrics.sql` (or a hidden `/stats/self` panel) for PRD success metrics: active days per week, undo rate, clarify rate, manual vs chat edit share, median latency.
      Done when: running it after a week of use prints all six numbers.

- [ ] **T36 Prod hardening**
      Needs: T32
      Do: push all migrations to cloud, confirm RLS on, confirm no secret has `NEXT_PUBLIC_`, set Gemini key restrictions, set spend alert, redeploy.
      Done when: checklist in this task is all true on prod.

- [ ] **T37 README**
      Needs: T36
      Do: setup, env vars, scripts, deploy, how to switch AI provider.
      Done when: a fresh clone can run locally by following it.

**Gate 4:** [ ] used daily for one week · [ ] AI cost on track for under $5 / month.

---

## Later (not in MVP)

Voice input · GitHub commit auto-logging · scheduled daily/weekly summaries · native mobile app · team sharing · offline AI.
