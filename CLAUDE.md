# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Static single-page Vue 3 app for tracking visits to the 20 botecos of **Comida di Buteco MOC 2026** (Montes Claros / MG). Deployed to GitHub Pages, backed by Supabase. UI copy is in pt-BR with mineiro slang — preserve the tone when editing strings.

## Architecture

**No build step.** Vue 3, Tailwind, and `@supabase/supabase-js` are all loaded from CDNs in [index.html](index.html). To "develop," edit files and reload — there is no bundler, no `package.json`, no `node_modules`.

**Four files do all the work:**
- [index.html](index.html) — full UI markup (login screen, list, modal) using Vue's in-DOM template syntax. References `#app`.
- [app.js](app.js) — single `createApp({ setup() })` with all state, computeds, and Supabase calls. Mounts `#app`.
- [config.js](config.js) — sets `window.CDB_CONFIG` with Supabase URL + anon key. Loaded before `app.js`.
- [dishes.js](dishes.js) — sets `window.CDB_DISHES`, the hardcoded list of 20 botecos.

Load order in `index.html` matters: `config.js` → `dishes.js` → Supabase SDK → `app.js`.

## Data model & "auth"

[schema.sql](schema.sql) defines two tables:
- `usuarios` — keyed by `telefone` (text, regex `^\d{11}$`), holds `nome`.
- `avaliacoes` — composite PK `(telefone, prato_id)`, with `nota` (1–5) and `obs`. FKs to `usuarios.telefone` ON DELETE CASCADE.

**There is no real auth.** RLS is enabled but both tables have `for all to anon using (true) with check (true)` — anyone with the anon key can read/write any user's data. The "login" in [app.js:90](app.js#L90) is just a phone-number lookup; the phone is then sent as a column value on every query. This is intentional for a 5-friend tracker — do not propose real auth without asking. The last-used phone is cached in `localStorage` under `cdb_telefone` for auto-login.

## Stable IDs are load-bearing

`dishes[].id` (e.g. `'balanca-vento'`) is the foreign key for `avaliacoes.prato_id`. Renaming an `id` orphans existing ratings. When swapping the dish list (new edition / city), keep IDs stable or write a migration in `schema.sql` comments alongside the change. The README documents the reset query at [README.md:96](README.md#L96).

## Running locally

Open `index.html` directly in a browser, or serve the directory with any static server (e.g. `python -m http.server`). No install, no test suite, no lint config — none exist.

## Deploying

Push to `main`. GitHub Pages serves from the repo root. See [README.md:39](README.md#L39).
