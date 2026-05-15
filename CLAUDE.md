# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

UYS v3 — Özler için Üretim Yönetim Sistemi (manufacturing/production ERP). React 19 + Vite + TypeScript SPA backed by Supabase Postgres, deployed to GitHub Pages at `/ozler-uys-v3/`. Domain language and most code comments are Turkish.

Two Supabase projects in use:
- **PROD:** `lmhcobrgrnvtprvmcito`
- **TEST:** `cowgxwmhlogmswatbltz` (Frankfurt, used by Playwright E2E and `npm run dev:test`)

## Operational rules (from `docs/DEVAM_NOTU.md`)

- **TEST first, then PROD with explicit approval.** Never apply schema or data changes to the PROD project without confirmation.
- **Supabase mutations go through MCP tools** — don't hand the user raw SQL to paste into PowerShell.
- **Passwords and secrets are never shown in conversation.**
- **The user closes their own Supabase MCP session** at end-of-session — don't volunteer to do it.
- **`docs/DEVAM_NOTU.md` is the single session-notes file** for this project. Read it at the start of a session; update it after meaningful work rather than creating new note files.
- **Two-machine setup:** the project runs on two Windows machines (`iskender.uzun` primary, `Iskender` secondary). The pre-push hook handles both paths — paths under `C:\Users\Iskender\…` are normal, not a typo.

## Common commands

```bash
npm run dev              # Vite dev server (PROD Supabase via .env)
npm run dev:test         # Dev server in test mode (.env.test, base path /)
npm run build            # Runs prebuild audits (schema + columns + saglik-syntax sentinel on DataManagement.tsx) then tsc --noEmit + vite build
npm run lint             # ESLint
npm run audit            # Schema audit only (DB vs code table lists)
npm run audit:columns    # Column audit (catches Supabase silent-reject on bad column names)
npm run test:unit        # Vitest — src/**/*.test.ts only
npm run test:unit:watch
npm run test:e2e         # Playwright — requires .env.test + test Supabase setup
npm run test:e2e:ui
npm run test:e2e:cleanup # Manually purge TEST-E2E-* rows from test DB
npx playwright test tests/e2e/specs/02-ie-stok-kontrol.spec.ts  # single spec
```

Pre-push hook (`scripts/git-hooks/pre-push`, installed via `scripts/install-hooks.ps1` setting `core.hooksPath`) runs the same 3 audits + `tsc --noEmit`. Don't bypass with `--no-verify` unless explicitly asked.

## Architecture

### Data flow: Supabase Proxy → Zustand store → React pages

`src/lib/supabase.ts` exports a **Proxy-wrapped** Supabase client. Every `.from(table)` call is intercepted to:
1. Block `insert/update/delete/upsert` when guest mode is on (`setGuestMode(true)`).
2. Auto-attach `test_run_id` on `insert/upsert` for tables in `TEST_RUN_TABLES` when an active test run is in `localStorage` (v15.37 test-mode feature).

Also exports `fetchAll(table)` — Supabase silently caps at 1000 rows, so this paginates. Use it for anything that might exceed 1000 rows (especially `uys_stok_hareketler`).

`src/store/index.ts` is the single Zustand store. The `TABLE_MAP` array at the top is the source of truth for **what loads in `loadAll()` and what realtime subscribes to** — adding a new table that should be globally cached means adding an entry here AND a mapper in the `M` object. Tables that are fetched locally by their owning page (chat messages, audit logs, MRP cache, etc.) are intentionally **excluded** and listed in `scripts/audit-schema.cjs` `STORE_WHITELIST`.

DB columns are snake_case; JS types are camelCase. The mapper functions in `M` (store/index.ts) translate `r.mamul_kod → mamulKod` etc. There's one quirk: the `not` reserved word is mapped to/from `not_` in DB (`SPECIAL_CAMEL_TO_SNAKE` in `audit-columns.cjs`).

`src/hooks/useRealtime.ts` subscribes one channel to all tables in `TABLE_MAP` and reloads affected slices via `reloadTables`. Self-originated mutations are debounced via `CLIENT_ID` to suppress echo toasts. `SESSIZ_TABLOLAR` are high-volume tables that reload silently.

### Auth & routing

`src/App.tsx` decides which `Routes` block to mount based on `useAuth()`:
- **Operator** (`isOperator`): only `OperatorRoutes` — no admin pages exist in history, and back-button is blocked via `popstate`.
- **Admin / RBAC role / Guest:** `AdminRoutes` with the full page set.

Uses `HashRouter` (URLs look like `#/orders`) — required because GitHub Pages doesn't do SPA fallback.

RBAC roles live in `src/lib/permissions.ts`: `admin | uretim_sor | planlama | depocu | guest | operator`. Action keys (e.g. `orders_add`, `wo_entry`, `mrp_calc`) are grouped in `ACTION_GROUPS`; per-action role lists can be overridden at runtime from the `uys_yetki_ayarlari` table via `setYetkiOverrides`. Use `can('action_key')` from `useAuth` to gate UI.

### Production / MRP domain

`src/features/production/` is where the real business logic lives:
- `mrp.ts` / `mrpCache.ts` — material requirements planning, with cache in `uys_mrp_state_global` + `uys_mrp_state_order` (v16.31). `mrpCache.ts` reads/writes Supabase directly (not through the store).
- `autoChain.ts` — "autoZincir": builds work orders from a recipe, creates cutting plans, runs MRP, creates supply orders. Idempotent by re-reading max `sira` from DB.
- `barModel.ts` / `cutting.ts` / `cuttingArtik.ts` — bar-stock cutting plan model (v15.31 schema). `uys_acik_barlar` tracks open bar remnants.
- `stokTuketim.ts` / `stokTahsis.ts` / `stokKontrol.ts` — stock consumption / allocation / availability checks.
- `validations.ts` — pre-flight checks before flows.

`pendingFlow.ts` (in `src/lib/`) plus `uys_pending_flows` table support resumable multi-step flows (decision-required transitions).

### SQL migrations

Migrations live in `sql/` named `YYYYMMDD_vXX_YY_description.sql`. They are **applied manually** (preferably via the Supabase MCP tools — see Operational rules), not auto-run. The deploy ordering rule from the README still holds: code + matching SQL ship in the same commit, but the SQL is executed by hand against the right project. `master_schema.sql` is the regenerated full schema; the dated files are individual deltas.

A separate `migrations/` directory holds DB-trigger SQL (e.g. `2026_05_05_recipe_op_sync_trigger_TUR1_3F.sql`) with TEST/PROD applied-on dates recorded in the file header — check those headers before re-applying.

When adding/renaming DB columns, update the relevant mapper in `src/store/index.ts` AND make sure `npm run audit` / `npm run audit:columns` pass.

### DevSync

The `/#/dev-sync` page uploads repo file contents to the `uys_dev_files` table so future Claude sessions can read the repo from Supabase without an upload step. Per `docs/DEVAM_NOTU.md`, this is the project's normal workflow — DevSync after changes, then git push.

## Conventions

- **Comments and UI strings are Turkish.** Match the surrounding code when adding new strings; don't translate existing Turkish to English.
- Imports use the `@/` alias for `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).
- Production build drops `console` and `debugger` via esbuild (`vite.config.ts`) — using `console.log` for runtime debugging will not work in deployed builds.
- E2E test data must be prefixed `TEST-E2E-` — cleanup is keyed on that prefix.
- Don't run interactive editor tools (`git rebase -i`, `git add -i`) — the user works on Windows and the bash hook environment is non-interactive.
