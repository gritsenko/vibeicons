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

Icons go to **IndexedDB** (`vibeicons` / store `kv` / key `"icons"`); everything else (`tweaks`, `setsMeta`, `groupsMeta`, `sources`, `favs`, `recents`) goes to **localStorage** under the `vibeicons.v1.*` prefix. Reason: full icon libraries can easily exceed the ~5 MB localStorage quota; metadata can't.

Loading order in `App.tsx`:
1. `useState` initializers synchronously read localStorage and seed `icons` with `SEED_ICONS` if nothing's there.
2. A `useEffect` opens IDB and, if it has icons, **overwrites** the seeded state. This means there's a brief flash of seed icons on first paint when the user has IDB data — accepted tradeoff.
3. Every `icons` change triggers `saveIconsToDb`, which falls back to localStorage if IDB is unavailable.

### Rendering imported SVG

`RenderedIcon.tsx` injects raw SVG via `innerHTML` (the `content` field is trusted) and then mutates the `<svg>` imperatively each render: strips `width`/`height`, forces `preserveAspectRatio="xMidYMid meet"`, infers `viewBox` from `width`/`height` if missing, sets `style.color`, and rewrites every `[fill]` attribute to `currentColor`. The recolor in the detail panel works by setting `style.color` on the parent — it does **not** mutate the SVG string. The SVG string is only colorized via regex (`lib/svg.ts::colorizeContent`) for download/copy, where `currentColor` wouldn't survive.

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
