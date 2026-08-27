# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm install
npm run dev          # Vite dev server on http://localhost:5173
npm run build        # tsc -b (project refs) && vite build → dist/
npm run preview      # serve production build locally
npm run typecheck    # tsc -b --noEmit (no Vite)
```

There are no tests, no linter, and no formatter configured. Don't add them unless asked. Node ≥ 20.19 (Vite 7 requirement).

## Architecture

### Origin

This is a port of a Claude Design prototype (HTML+UMD React+Babel-Standalone) to a Vite + React 19 + TypeScript project. The original prototype and conversation transcripts live in `.design-bundle/` and are gitignored — they're authoritative for *intent*, not for current code structure. If you need to know "why does it work this way," `.design-bundle/vibeicons/chats/*.md` has the iteration history.

### Data model and per-source namespacing (the load-bearing decision)

A library import is a JSON file with `icons[]`, optional `sets[]`, and optional `groups[]`. Two libraries can use overlapping numeric IDs for sets/groups, and overlapping icon names. To keep them isolated:

- On import, every `set_id` and `group_id` is rewritten to `"<sourceName>:<id>"` (see `App.tsx::handleImport` → `ns()`).
- The source name itself is auto-suffixed (`"Foo (2)"`) if it clashes with an existing source.
- Each import also gets a synthetic root group `"<sourceName>:__lib"` so the library appears as its own top-level branch under "Library" in the sidebar.
- Sets/groups whose JSON specifies `group_id` get re-parented to the namespaced parent; those without get attached to the synthetic library group.
- Icons keep their **original** name but are deduped only **within a single import** — same name from a different source is a separate `IconRecord`. The composite key `"<source>::<name>"` is used everywhere user identity matters: favorites, recents, grid React keys, "is selected?" checks, and the Variations panel (which shows other libraries' versions of the same name).

If you change ID handling, make sure all four maps stay coherent: `icons[].set_id`, `setsMeta`, `groupsMeta`, and `sources`.

### Storage split

Icons, sets, groups and sources live in **IndexedDB** (`vibeicons`, schema v2) as proper records across five object stores — `icons` (keyPath `"key"` = `<source>::<name>`, with indexes on `set_id` / `source` / `style` / `name`), `sets` (keyPath `"id"`), `groups` (keyPath `"id"`), `sources` (keyPath `"name"`), and a free-form `meta` store. Tweaks, favorites and recents stay in **localStorage** under the `vibeicons.v1.*` prefix because they're tiny and benefit from synchronous reads. One key sits deliberately outside that prefix: `vibeicons.preset.v1.init`, the "preset already applied" flag — `clearAllStorage()` must not clear it (see below).

Loading order in `App.tsx`:
1. `useState` initializes `icons` to `[]`. Brief empty-grid paint on first load is acceptable.
2. A `useEffect` opens the DB, then `Promise.all`s `getAllIcons` / `getAllSets` / `getAllGroups` / `getAllSources` and replaces state.
3. If `icons.length === 0`, the main area renders `<LibraryEmpty>` instead of the grid — a placeholder with CTAs ("Load preset icons", "Import a JSON file", "Import SVG folder"). The only automatic import is the first-run preset (see below); everything else is explicit user action.
4. Imports persist as **deltas** (`bulkPutIcons` / `bulkPutSets` / `bulkPutGroups` / `putSource`) — no full-array rewrites.
5. `clearAll` calls `clearAllDb` (one transaction across every store) and resets all state to empty. The user is dropped back on the `LibraryEmpty` placeholder; restoring the preset is a deliberate click, not magic — the preset flag survives, so a reload keeps the library empty.
6. `resetEverything` (Settings → Full reset) is the testing affordance for the cold-start path: `clearAllStorage()` + `clearPresetInitialized()` + `clearAllDb`, then `window.location.reload()` so the app comes back up as a fresh install and re-runs the preset import.

A v1→v2 migration path exists: when `openDb()` upgrades from version 1, it reads any legacy `kv.icons` array within the upgrade transaction, returns it as `legacyIcons`, and the post-open code calls `rehydrateLegacyIcon` + `bulkPutIcons` to write it into the new shape.

### Preset libraries (`public/preset.json`) and the bundled Ant Design build

The base library is **Ant Design Icons** (`@ant-design/icons-svg`, MIT). `scripts/build-ant-icons.mjs` reads each SVG from the package's `inline-svg/{outlined,filled,twotone}/` directories, injects `fill="currentColor"` on the root `<svg>` so the `style.color` cascade actually works (outlined ant icons have no fills set otherwise), and writes three importable JSON files plus a manifest into `public/libraries/`. The script is wired to `predev`/`prebuild` and the output dir is gitignored. Twotone icons render monochrome because the preprocessor collapses both fill colors to `currentColor` — that's an accepted tradeoff. Each theme becomes its own `source` (`Ant Design Outlined` / `Ant Design Filled` / `Ant Design TwoTone`), which keeps icon names like `home` distinct across themes via the composite key and makes the Variations panel light up naturally.

What the app initialises itself with is **data, not code**: `public/preset.json` (checked into VCS) lists the sources. `src/lib/preset.ts::loadPresetSources` fetches it and expands each entry into `{name, url}` pairs — `kind: "library"` (default) is a single import-ready JSON, `kind: "manifest"` is an index.json listing several (that's how the generated Ant Design manifest is referenced). Relative URLs resolve against `import.meta.env.BASE_URL`, absolute http(s) URLs pass through. It never throws: a missing or broken preset yields `[]`.

`App.tsx::loadPresetLibraries` walks that list, skips sources already present in `sources`, and feeds the rest through the regular `handleImport` path with a shared `taken` set. It backs three call sites: the `LibraryEmpty` CTA, the Settings → "Preset library" button, and the first-run effect. `presetLoading` drives the disabled+spinner state.

First-run import (the effect right after `loadPresetLibraries`, guarded by `presetInitRef` so it fires once per mount):

- waits for both `initialLoad.done` (the IDB cold read finished — set even when `openDb()` returns null) and `preset.loaded`;
- no-ops if `isPresetInitialized()`;
- if the cold read found icons (an install predating preset.json), just marks the flag — never imports on top of existing data;
- otherwise imports the preset and marks the flag **only if something was actually imported**, so an offline/404 first launch retries next time.

Result: idempotent on repeat clicks, one automatic import per device, and the library never silently grows behind the user's back after that.

### Rendering imported SVG

SVG content is **preprocessed once at import time** by `lib/svg.ts::preprocessSvgContent`: strips `width`/`height`, sets `preserveAspectRatio="xMidYMid meet"`, infers a `viewBox` from `width`/`height` if missing, and rewrites every non-`none` `fill="..."` to `fill="currentColor"`. The processed string is what's stored in IDB, so `RenderedIcon.tsx` just `dangerouslySetInnerHTML`s it once and lets `style.color` cascade via `currentColor`. No per-render attribute mutation. `RenderedIcon` is wrapped in `React.memo` keyed on `icon.key + size + color`. For download/copy, `colorizeContent` swaps `currentColor` (and any other non-`none` fill) to a literal hex.

### Virtualized grid

`components/IconGrid.tsx` is a dependency-free virtualized grid: a `ResizeObserver` measures the canvas width to compute `cols = floor((width + GAP) / (tileMin + GAP))`, an `onScroll` handler tracks `scrollTop`, and only the visible row range ± `ROW_BUFFER` is rendered. Each `Tile` is `React.memo`'d. `tileMin` comes from a per-density map (compact 64 / comfortable 88 / spacious 112). Selection is tracked by `selectedKey` (a stable composite string), not by index, so changing filters never points "selected" at the wrong icon.

### Search index

Each `IconRecord` carries a precomputed `search` field — a lowercased concatenation of `name + " " + tags + " " + source`, built by `lib/icons.ts::buildSearch` at import / rehydrate time. The filter loop uses `useDeferredValue(query)` (React 19) and runs `ic.search.includes(q)` instead of building the haystack on every keystroke, so typing stays responsive even at 5000+ icons.

### Filter pipeline

`App.tsx::filtered` is a single `useMemo` that AND-combines:
- `activeNav` (`all` / `favorites` / `recents`) — checks composite key membership in `favorites` / `recents`.
- `activeSource`, `activeSet`, `activeStyle` — direct equality.
- `activeGroup` — recursively expands into a `Set` of allowed `set_id`s by walking `groupsMeta` and `setsMeta` for descendants.
- `query` — substring match against `name + tags + source`, lowercased.

`selected` is `filtered[selectedIdx]`; navigation just moves the index. When the user clicks a Variation that's filtered out, the panel resets all filters and re-selects on the next tick.

### TypeScript config

Two project refs (`tsconfig.app.json` for `src/`, `tsconfig.node.json` for `vite.config.ts`). The app config has `strict`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (so use `import type` for type-only imports), and `"types": ["vite/client"]` to pick up `.css` side-effect imports. Don't add a separate `vite-env.d.ts`.

### What's intentionally absent

- No `tweaks-panel.jsx` from the design bundle — that was Claude Design's hot-tweak overlay, not a product feature. Theme/density/accent/labels are reachable via the topbar buttons, density segment in the toolbar, and Settings modal.
- No router. The whole app is one screen with side panels.
- No state library. `useState` + `useMemo` are sufficient at this size; resist adding Zustand/Redux unless complexity warrants it.
- No `seed.ts`. The earlier hand-rolled placeholder records were removed when Ant Design became the bundled base library — `clearAll` now restores Ant Design rather than a synthetic seed set.
