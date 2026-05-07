import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  GroupMeta,
  GroupsMetaMap,
  IconRecord,
  ImportFile,
  SetMeta,
  SetsMetaMap,
  SourceMeta,
  SourcesMap,
  Tweaks,
} from "./types";
import { STORAGE_KEY, clearAllStorage, readJson, writeJson } from "./lib/storage";
import {
  bulkPutGroups,
  bulkPutIcons,
  bulkPutSets,
  clearAll as clearAllDb,
  getAllGroups,
  getAllIcons,
  getAllSets,
  getAllSources,
  openDb,
  putSource,
} from "./lib/db";
import { iconKey, normalizeImportedIcon } from "./lib/icons";
import { Icon } from "./components/Icon";
import { HierarchyTree } from "./components/HierarchyTree";
import { DetailPanel } from "./components/DetailPanel";
import { SettingsModal } from "./components/SettingsModal";
import { IconGrid } from "./components/IconGrid";
import { GroupedIconGrid } from "./components/GroupedIconGrid";
import { HomeView } from "./components/HomeView";
import { LibraryEmpty } from "./components/LibraryEmpty";

declare const __APP_VERSION__: string;

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: "home" },
  { key: "all", label: "All icons", icon: "grid" },
  { key: "favorites", label: "Favorites", icon: "star" },
  { key: "recents", label: "Recents", icon: "clock" },
] as const;

type NavKey = (typeof NAV_ITEMS)[number]["key"];

const TWEAK_DEFAULTS: Tweaks = {
  theme: "light",
  density: "compact",
  accent: "#F97316",
  showLabels: true,
};

const TILE_MIN_BY_DENSITY: Record<Tweaks["density"], number> = {
  compact: 64,
  comfortable: 88,
  spacious: 112,
};

function toMap<T extends { id?: string | number; name?: string }>(
  list: T[],
  key: keyof T,
): Record<string, T> {
  const m: Record<string, T> = {};
  for (const item of list) m[String(item[key])] = item;
  return m;
}

export function App() {
  // === Tweaks ===
  const [tweaks, setTweaks] = useState<Tweaks>(() =>
    readJson<Tweaks>(STORAGE_KEY + ".tweaks", TWEAK_DEFAULTS),
  );
  const setTweak = <K extends keyof Tweaks>(key: K, value: Tweaks[K]) =>
    setTweaks((prev) => ({ ...prev, [key]: value }));
  useEffect(() => {
    writeJson(STORAGE_KEY + ".tweaks", tweaks);
  }, [tweaks]);

  // === Data ===
  const [icons, setIcons] = useState<IconRecord[]>([]);
  const [setsMeta, setSetsMeta] = useState<SetsMetaMap>({});
  const [groupsMeta, setGroupsMeta] = useState<GroupsMetaMap>({});
  const [sources, setSources] = useState<SourcesMap>({});

  // Favorites & recents are small (≤ a few hundred) — keep in localStorage for fast sync writes.
  const [favorites, setFavorites] = useState<string[]>(() =>
    readJson<string[]>(STORAGE_KEY + ".favs", []),
  );
  const [recents, setRecents] = useState<string[]>(() =>
    readJson<string[]>(STORAGE_KEY + ".recents", []),
  );
  const favoritesSet = useMemo(() => new Set(favorites), [favorites]);
  const recentsSet = useMemo(() => new Set(recents), [recents]);

  useEffect(() => writeJson(STORAGE_KEY + ".favs", favorites), [favorites]);
  useEffect(() => writeJson(STORAGE_KEY + ".recents", recents), [recents]);

  // === DB lifecycle ===
  const dbRef = useRef<IDBDatabase | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const opened = await openDb();
      if (cancelled) return;
      if (!opened) return;
      dbRef.current = opened.db;

      const [iconList, setList, groupList, sourceList] = await Promise.all([
        getAllIcons(opened.db),
        getAllSets(opened.db),
        getAllGroups(opened.db),
        getAllSources(opened.db),
      ]);

      // If the DB has nothing yet but we got legacy icons via the v1→v2 upgrade,
      // adopt those and persist them in the new shape.
      let effectiveIcons = iconList;
      if (effectiveIcons.length === 0 && opened.legacyIcons && opened.legacyIcons.length) {
        effectiveIcons = opened.legacyIcons;
        try {
          await bulkPutIcons(opened.db, effectiveIcons);
        } catch {
          /* ignore */
        }
      }

      if (cancelled) return;
      if (effectiveIcons.length > 0) setIcons(effectiveIcons);
      if (setList.length > 0) setSetsMeta(toMap(setList, "id"));
      if (groupList.length > 0) setGroupsMeta(toMap(groupList, "id"));
      if (sourceList.length > 0) setSources(toMap(sourceList, "name"));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // === UI state ===
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [activeNav, setActiveNav] = useState<NavKey>("all");
  const [activeSet, setActiveSet] = useState<string | number | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | number | null>(null);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [color, setColor] = useState("#F7F7F7");
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [groupBy, setGroupBy] = useState<boolean>(() =>
    readJson<boolean>(STORAGE_KEY + ".groupBy", false),
  );
  useEffect(() => writeJson(STORAGE_KEY + ".groupBy", groupBy), [groupBy]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupExpand = useCallback((id: string | number) => {
    setExpandedGroups((prev) => ({ ...prev, [String(id)]: !prev[String(id)] }));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  // clearAll is defined further down so it can call loadBundledLibraries
  // (which depends on handleImport defined later in this component).

  // === Theme & accent ===
  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.style.setProperty("--accent", tweaks.accent);
    document.documentElement.style.setProperty("--accent-strong", tweaks.accent);
    document.documentElement.style.setProperty("--accent-soft", tweaks.accent + "26");
  }, [tweaks.theme, tweaks.density, tweaks.accent]);

  // === Aggregations & indexes (single pass over icons) ===
  const aggregates = useMemo(() => {
    const setCounts = new Map<string | number, number>();
    const styleCounts = new Map<string, number>();
    const sourceCounts = new Map<string, number>();
    const byName = new Map<string, IconRecord[]>();
    const keyToIndex = new Map<string, number>();
    for (let i = 0; i < icons.length; i++) {
      const ic = icons[i];
      const sk: string | number = ic.set_id ?? "—";
      setCounts.set(sk, (setCounts.get(sk) ?? 0) + 1);
      const st = ic.style || "other";
      styleCounts.set(st, (styleCounts.get(st) ?? 0) + 1);
      if (ic.source) sourceCounts.set(ic.source, (sourceCounts.get(ic.source) ?? 0) + 1);
      const list = byName.get(ic.name);
      if (list) list.push(ic);
      else byName.set(ic.name, [ic]);
      keyToIndex.set(ic.key, i);
    }
    return { setCounts, styleCounts, sourceCounts, byName, keyToIndex };
  }, [icons]);

  const sets = useMemo(() => {
    return [...aggregates.setCounts.entries()].sort((a, b) => {
      const la = setsMeta[String(a[0])]?.label ?? "Set " + a[0];
      const lb = setsMeta[String(b[0])]?.label ?? "Set " + b[0];
      return la.localeCompare(lb);
    });
  }, [aggregates.setCounts, setsMeta]);

  const styles = useMemo(
    () => [...aggregates.styleCounts.entries()],
    [aggregates.styleCounts],
  );

  const setLabel = useCallback(
    (id: string | number | null) => setsMeta[String(id)]?.label ?? "Set " + id,
    [setsMeta],
  );

  // Resolve activeGroup → set of allowed set_ids (recursive)
  const allowedSetIds = useMemo(() => {
    if (activeGroup == null) return null;
    const out = new Set<string | number>();
    const childSets = new Map<string | number | null, SetMeta[]>();
    for (const s of Object.values(setsMeta)) {
      const p = s.group_id ?? null;
      const arr = childSets.get(p);
      if (arr) arr.push(s);
      else childSets.set(p, [s]);
    }
    const childGroups = new Map<string | number | null, GroupMeta[]>();
    for (const g of Object.values(groupsMeta)) {
      const p = g.group_id ?? null;
      const arr = childGroups.get(p);
      if (arr) arr.push(g);
      else childGroups.set(p, [g]);
    }
    const collect = (gid: string | number) => {
      (childSets.get(gid) ?? []).forEach((s) => out.add(s.id));
      (childGroups.get(gid) ?? []).forEach((sg) => collect(sg.id));
    };
    collect(activeGroup);
    return out;
  }, [activeGroup, setsMeta, groupsMeta]);

  // === Filter pipeline ===
  // Collapse favorites/recents into a single "active filter set" so that
  // toggling a favorite or bumping recents doesn't invalidate `baseFiltered`
  // when the user is on a different nav (e.g. "All"). Without this, every
  // click — which updates `recents` — would produce a new `filtered` array
  // reference, causing IconGrid to reset its scroll and bounce the selected
  // icon to the bottom of the viewport.
  const navFilterSet = useMemo<Set<string> | null>(() => {
    if (activeNav === "favorites") return favoritesSet;
    if (activeNav === "recents") return recentsSet;
    return null;
  }, [activeNav, favoritesSet, recentsSet]);

  // baseFiltered: all filters except tag chips. Tag aggregation is computed
  // from this so toggling a tag doesn't make the other tags disappear.
  const baseFiltered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const out: IconRecord[] = [];
    for (let i = 0; i < icons.length; i++) {
      const ic = icons[i];
      if (navFilterSet && !navFilterSet.has(ic.key)) continue;
      if (activeSet != null && ic.set_id !== activeSet) continue;
      if (allowedSetIds && (ic.set_id == null || !allowedSetIds.has(ic.set_id))) continue;
      if (activeStyle != null && ic.style !== activeStyle) continue;
      if (q && !ic.search.includes(q)) continue;
      out.push(ic);
    }
    return out;
  }, [
    icons,
    deferredQuery,
    activeSet,
    activeStyle,
    allowedSetIds,
    navFilterSet,
  ]);

  const splitTags = (s: string): string[] =>
    s ? s.split(/[,;]/).map((t) => t.trim()).filter(Boolean) : [];

  const tagAggregate = useMemo(() => {
    const counts = new Map<string, number>();
    for (const ic of baseFiltered) {
      for (const t of splitTags(ic.tags)) {
        counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) =>
      b[1] - a[1] || a[0].localeCompare(b[0]),
    );
  }, [baseFiltered]);

  const filtered = useMemo(() => {
    if (activeTags.length === 0) return baseFiltered;
    return baseFiltered.filter((ic) => {
      const tags = splitTags(ic.tags);
      return activeTags.every((t) => tags.includes(t));
    });
  }, [baseFiltered, activeTags]);

  const toggleTag = useCallback((tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  // === Selection ===
  const selected = useMemo(() => {
    if (!selectedKey) return filtered[0] ?? null;
    const fromFiltered = filtered.find((i) => i.key === selectedKey);
    if (fromFiltered) return fromFiltered;
    const idx = aggregates.keyToIndex.get(selectedKey);
    return idx != null ? icons[idx] : (filtered[0] ?? null);
  }, [selectedKey, filtered, icons, aggregates.keyToIndex]);

  // Track recents when selection changes
  useEffect(() => {
    if (!selected) return;
    const key = selected.key;
    setRecents((prev) => {
      if (prev[0] === key) return prev;
      const next = [key, ...prev.filter((n) => n !== key)];
      if (next.length > 24) next.length = 24;
      return next;
    });
  }, [selected]);

  const toggleFav = useCallback((key: string) => {
    setFavorites((prev) =>
      prev.includes(key) ? prev.filter((n) => n !== key) : [...prev, key],
    );
  }, []);

  // === Import ===
  const handleImport = useCallback(
    (
      text: string,
      fileName?: string,
      opts?: { takenNames?: Set<string>; silent?: boolean },
    ): { sourceName: string; imported: number; skipped: number } | null => {
      try {
        const parsed = JSON.parse(text) as ImportFile | unknown[];
        const list: unknown[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray((parsed as ImportFile).icons)
            ? ((parsed as ImportFile).icons as unknown[])
            : [];
        if (!list.length) throw new Error("No icons array found");

        let sourceName = fileName ? fileName.replace(/\.json$/i, "") : "Imported";
        const taken = opts?.takenNames;
        const isTaken = (n: string) => Boolean(sources[n]) || (taken?.has(n) ?? false);
        if (isTaken(sourceName)) {
          let n = 2;
          while (isTaken(sourceName + " (" + n + ")")) n++;
          sourceName = sourceName + " (" + n + ")";
        }
        taken?.add(sourceName);
        const ns = (id: string | number | null | undefined): string | null =>
          id == null ? null : sourceName + ":" + id;

        const seenNames = new Set<string>();
        const newIcons: IconRecord[] = [];
        let skipped = 0;
        for (const raw of list) {
          const norm = normalizeImportedIcon(raw, sourceName);
          if (!norm) {
            skipped++;
            continue;
          }
          if (seenNames.has(norm.name)) {
            skipped++;
            continue;
          }
          seenNames.add(norm.name);
          norm.set_id = ns(norm.set_id);
          // Recompute key now that set_id changed (key depends on name+source, not set, so unchanged — kept for safety)
          norm.key = iconKey(norm);
          newIcons.push(norm);
        }

        const libraryGroupId = sourceName + ":__lib";
        const libraryGroup: GroupMeta = {
          id: libraryGroupId,
          label: sourceName,
          group_id: null,
        };
        const newGroups: GroupMeta[] = [libraryGroup];
        const newSets: SetMeta[] = [];

        const fileObj = !Array.isArray(parsed) ? (parsed as ImportFile) : null;
        if (fileObj?.sets && Array.isArray(fileObj.sets)) {
          for (const s of fileObj.sets) {
            if (s && s.id != null) {
              const nid = ns(s.id);
              if (nid == null) continue;
              const parent = s.group_id != null ? ns(s.group_id) : libraryGroupId;
              newSets.push({
                id: nid,
                label: s.label ?? "Set " + s.id,
                group_id: parent,
              });
            }
          }
        }
        if (fileObj?.groups && Array.isArray(fileObj.groups)) {
          for (const g of fileObj.groups) {
            if (g && g.id != null) {
              const nid = ns(g.id);
              if (nid == null) continue;
              const parent = g.group_id != null ? ns(g.group_id) : libraryGroupId;
              newGroups.push({
                id: nid,
                label: g.label ?? "Group " + g.id,
                group_id: parent,
              });
            }
          }
        }

        const sourceMeta: SourceMeta = { name: sourceName, count: newIcons.length };

        // Update React state (functional updates avoid stale closures during the async DB writes below).
        setIcons((prev) => prev.concat(newIcons));
        setSetsMeta((prev) => {
          const next = { ...prev };
          for (const s of newSets) next[String(s.id)] = s;
          return next;
        });
        setGroupsMeta((prev) => {
          const next = { ...prev };
          for (const g of newGroups) next[String(g.id)] = g;
          return next;
        });
        setSources((prev) => ({ ...prev, [sourceName]: sourceMeta }));

        // Persist deltas to IDB (fire-and-forget; React state already updated for instant UX).
        const db = dbRef.current;
        if (db) {
          void Promise.all([
            bulkPutIcons(db, newIcons),
            bulkPutSets(db, newSets),
            bulkPutGroups(db, newGroups),
            putSource(db, sourceMeta),
          ]).catch((e) => console.warn("DB persist failed", e));
        }

        if (!opts?.silent) {
          showToast(
            `Imported ${newIcons.length} icons as "${sourceName}"` +
              (skipped ? ` · ${skipped} skipped` : ""),
          );
        }
        return { sourceName, imported: newIcons.length, skipped };
      } catch (e) {
        console.error("Import failed:", e);
        if (!opts?.silent) {
          showToast("Invalid JSON: " + (e instanceof Error ? e.message : String(e)));
        }
        return null;
      }
    },
    [sources, showToast],
  );

  // Bundled libraries (Ant Design icons) live under public/libraries/ — the
  // files are generated by scripts/build-ant-icons.mjs (runs on predev/prebuild)
  // and listed in index.json. Triggered manually from the empty-state CTA or
  // the Settings modal.
  const [bundledLoading, setBundledLoading] = useState(false);
  const loadBundledLibraries = useCallback(async (): Promise<number> => {
    setBundledLoading(true);
    try {
      const baseUrl = import.meta.env.BASE_URL;
      const idxRes = await fetch(`${baseUrl}libraries/index.json`);
      if (!idxRes.ok) return 0;
      const manifest = (await idxRes.json()) as {
        libraries?: Array<{ file: string; source: string }>;
      };
      const entries = manifest.libraries ?? [];
      if (entries.length === 0) return 0;
      const taken = new Set<string>();
      let imported = 0;
      for (const entry of entries) {
        // Skip libraries whose source is already loaded so repeat clicks are
        // idempotent instead of producing "Ant Design Outlined (2)" duplicates.
        if (sources[entry.source]) continue;
        const r = await fetch(`${baseUrl}libraries/${entry.file}`);
        if (!r.ok) continue;
        const text = await r.text();
        const result = handleImport(text, entry.source + ".json", {
          takenNames: taken,
          silent: true,
        });
        if (result) imported += result.imported;
      }
      if (imported > 0) showToast(`Loaded ${imported} bundled icons`);
      return imported;
    } catch (e) {
      console.warn("Bundled library load failed:", e);
      return 0;
    } finally {
      setBundledLoading(false);
    }
  }, [handleImport, sources, showToast]);

  const clearAll = useCallback(() => {
    setIcons([]);
    setSetsMeta({});
    setGroupsMeta({});
    setSources({});
    setFavorites([]);
    setRecents([]);
    setActiveSet(null);
    setActiveGroup(null);
    setActiveStyle(null);
    setActiveTags([]);
    setActiveNav("all");
    setSelectedKey(null);
    setExpandedGroups({});
    clearAllStorage();
    if (dbRef.current) void clearAllDb(dbRef.current);
    setShowSettings(false);
    showToast("All data cleared");
  }, [showToast]);

  const onFiles = useCallback(
    (fileList: FileList | File[] | null | undefined) => {
      if (!fileList) return;
      const files = Array.from(fileList);
      if (files.length === 0) return;
      const single = files.length === 1;
      void (async () => {
        const reads = await Promise.all(
          files.map(async (f) => {
            try {
              return { name: f.name, text: await f.text(), error: null as unknown };
            } catch (e) {
              return { name: f.name, text: null, error: e };
            }
          }),
        );
        const taken = new Set<string>();
        let imported = 0;
        let skipped = 0;
        let ok = 0;
        let failed = 0;
        for (const r of reads) {
          if (r.text == null) {
            failed++;
            console.error("Read failed:", r.name, r.error);
            continue;
          }
          const result = handleImport(r.text, r.name, {
            takenNames: taken,
            silent: !single,
          });
          if (result) {
            ok++;
            imported += result.imported;
            skipped += result.skipped;
          } else {
            failed++;
          }
        }
        if (!single) {
          showToast(
            `Imported ${imported} icons from ${ok} file${ok === 1 ? "" : "s"}` +
              (skipped ? ` · ${skipped} skipped` : "") +
              (failed ? ` · ${failed} failed` : ""),
          );
        }
      })();
    },
    [handleImport, showToast],
  );

  const copyText = useCallback(
    (s: string, label = "SVG") => {
      void navigator.clipboard.writeText(s);
      showToast(`${label} copied`);
    },
    [showToast],
  );

  // === Keyboard navigation ===
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        const cur = selected ? filtered.findIndex((f) => f.key === selected.key) : -1;
        const delta = e.key === "ArrowRight" ? 1 : -1;
        const next = Math.max(0, Math.min(filtered.length - 1, (cur < 0 ? 0 : cur) + delta));
        const nextIcon = filtered[next];
        if (nextIcon) setSelectedKey(nextIcon.key);
      } else if (e.key === "/") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>(".search-bar input")?.focus();
      } else if (e.key === "f" && selected) {
        toggleFav(selected.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selected, toggleFav]);

  const variations = useMemo(() => {
    if (!selected) return [];
    const all = aggregates.byName.get(selected.name) ?? [];
    return all.filter((i) => i.source !== selected.source);
  }, [selected, aggregates.byName]);

  const selectVariation = useCallback(
    (v: IconRecord) => {
      const inFiltered = filtered.find((f) => f.name === v.name && f.source === v.source);
      if (inFiltered) {
        setSelectedKey(inFiltered.key);
        return;
      }
      // The variation isn't in the current view — drop filters and select it.
      setActiveNav("all");
      setActiveSet(null);
      setActiveGroup(null);
      setActiveStyle(null);
      setActiveTags([]);
      setQuery("");
      setSelectedKey(v.key);
    },
    [filtered],
  );

  const fgGridColor = tweaks.theme === "dark" ? "#e6e8ec" : "#1a1d23";
  const tileMin = TILE_MIN_BY_DENSITY[tweaks.density];
  const isHome = activeNav === "home";
  const isEmpty = icons.length === 0;
  // Grouping renders every tile non-virtualized — too costly on the unfiltered
  // "All icons" view. Allow it only after a library/group/set narrows things.
  const groupingDisabled =
    activeNav === "all" && activeSet == null && activeGroup == null;
  const effectiveGroupBy = groupBy && !groupingDisabled;

  return (
    <div className={"app" + (isHome || !selected ? " no-detail" : "")}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <span>VibeIcons</span>
          <span className="brand-version">v{__APP_VERSION__}</span>
        </div>
        <div className="search-bar">
          <Icon name="search" size={14} />
          <input
            placeholder="Search by name or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                e.stopPropagation();
                setQuery("");
              }
            }}
          />
          {query ? (
            <button
              type="button"
              className="search-clear"
              title="Clear search (Esc)"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                document.querySelector<HTMLInputElement>(".search-bar input")?.focus();
              }}
            >
              <Icon name="x" size={12} />
            </button>
          ) : (
            <span className="kbd">/</span>
          )}
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" title="Settings" onClick={() => setShowSettings(true)}>
            <Icon name="settings" size={15} />
          </button>
          <button
            className="icon-btn"
            title="Toggle theme"
            onClick={() => setTweak("theme", tweaks.theme === "dark" ? "light" : "dark")}
          >
            <Icon name={tweaks.theme === "dark" ? "sun" : "moon"} size={15} />
          </button>
          <label className="btn btn-primary" style={{ cursor: "pointer" }}>
            <Icon name="upload" size={13} />
            Import JSON
            <input
              id="vibe-file-input"
              type="file"
              accept=".json,application/json"
              multiple
              hidden
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
        </div>
      </header>

      <aside className="sidebar">
        <div className="side-section">
          <div className="side-label">Library</div>
          {NAV_ITEMS.map((n) => {
            const count =
              n.key === "favorites"
                ? favorites.length
                : n.key === "recents"
                  ? recents.length
                  : n.key === "home"
                    ? Object.keys(sources).length || undefined
                    : icons.length;
            const isActive =
              activeNav === n.key &&
              (n.key === "home" ||
                (activeSet == null && activeStyle == null && activeGroup == null));
            return (
              <div
                key={n.key}
                className={"side-item" + (isActive ? " active" : "")}
                onClick={() => {
                  setActiveNav(n.key);
                  setActiveSet(null);
                  setActiveStyle(null);
                  if (n.key === "home") {
                    setActiveGroup(null);
                    setActiveTags([]);
                    setQuery("");
                  }
                }}
              >
                <Icon name={n.icon} size={14} />
                <span>{n.label}</span>
                {count != null && <span className="side-count">{count}</span>}
              </div>
            );
          })}
        </div>

        <div className="side-divider" />

        <div className="side-section">
          <div className="side-label">
            Library <span className="count">{sets.length}</span>
          </div>
          <HierarchyTree
            groupsMeta={groupsMeta}
            setsMeta={setsMeta}
            sets={sets}
            expandedGroups={expandedGroups}
            toggleGroupExpand={toggleGroupExpand}
            activeGroup={activeGroup}
            activeSet={activeSet}
            onPickGroup={(id) => {
              setActiveGroup(activeGroup === id ? null : id);
              setActiveSet(null);
              setActiveNav("all");
            }}
            onPickSet={(id) => {
              setActiveSet(activeSet === id ? null : id);
              setActiveGroup(null);
              setActiveNav("all");
            }}
          />
        </div>

        <div className="side-divider" />

        <div className="side-section">
          <div className="side-label">Style</div>
          {styles.map(([s, count]) => (
            <div
              key={s}
              className={"side-item" + (activeStyle === s ? " active" : "")}
              onClick={() => {
                setActiveStyle(activeStyle === s ? null : s);
                setActiveNav("all");
              }}
            >
              <Icon name="layers" size={14} />
              <span style={{ textTransform: "capitalize" }}>{s}</span>
              <span className="side-count">{count}</span>
            </div>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div
          className={"dnd-zone" + (dragging ? " dragging" : "")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            onFiles(e.dataTransfer.files);
          }}
          onClick={() => document.getElementById("vibe-file-input")?.click()}
        >
          <Icon name="upload" size={16} />
          <div className="dnd-zone-title">Drop JSON here</div>
          <div className="dnd-zone-hint">or click to browse · multiple files OK</div>
        </div>
      </aside>

      <main className="main">
        {!isHome && !isEmpty && (
          <div className="toolbar">
            <div className="toolbar-group">
              <button
                className={"chip" + (activeStyle === null ? " active" : "")}
                onClick={() => setActiveStyle(null)}
              >
                <span className="dot" />
                All styles
              </button>
              {styles.map(([s]) => (
                <button
                  key={s}
                  className={"chip" + (activeStyle === s ? " active" : "")}
                  onClick={() => setActiveStyle(activeStyle === s ? null : s)}
                >
                  <span className="dot" />
                  {s}
                </button>
              ))}
            </div>

            {tagAggregate.length > 0 && (
              <div className="toolbar-group toolbar-tags">
                {tagAggregate.slice(0, 12).map(([tag, count]) => (
                  <button
                    key={tag}
                    className={"chip chip-tag" + (activeTags.includes(tag) ? " active" : "")}
                    onClick={() => toggleTag(tag)}
                    title={`${tag} · ${count}`}
                  >
                    <span className="chip-hash">#</span>
                    {tag}
                  </button>
                ))}
              </div>
            )}

            <div className="toolbar-spacer" />

            <button
              type="button"
              className={"group-toggle" + (effectiveGroupBy ? " active" : "")}
              onClick={() => setGroupBy((v) => !v)}
              disabled={groupingDisabled}
              title={
                groupingDisabled
                  ? "Pick a library, group or set first — grouping all icons would be too heavy"
                  : effectiveGroupBy
                    ? "Show as a flat grid"
                    : "Group icons by set"
              }
            >
              <Icon name="rows" size={13} />
              Group
            </button>

            <div className="size-segment">
              {(["compact", "comfortable", "spacious"] as const).map((d) => (
                <button
                  key={d}
                  className={tweaks.density === d ? "active" : ""}
                  onClick={() => setTweak("density", d)}
                >
                  {d === "compact" ? "S" : d === "comfortable" ? "M" : "L"}
                </button>
              ))}
            </div>

            <div className="toolbar-info">
              <b>{filtered.length}</b> / {icons.length} icons
            </div>
          </div>
        )}

        {isEmpty ? (
          <LibraryEmpty
            loading={bundledLoading}
            onLoadBundled={() => void loadBundledLibraries()}
            onPickFile={() => document.getElementById("vibe-file-input")?.click()}
          />
        ) : isHome ? (
          <HomeView
            icons={icons}
            sources={sources}
            fgColor={fgGridColor}
            onPickIcon={(key) => {
              setActiveNav("all");
              setSelectedKey(key);
            }}
            onPickSource={(source) => {
              setActiveNav("all");
              setActiveSet(null);
              setActiveStyle(null);
              setActiveTags([]);
              setQuery("");
              setActiveGroup(source ? source + ":__lib" : null);
            }}
            onPickStyle={(style) => {
              setActiveNav("all");
              setActiveSet(null);
              setActiveGroup(null);
              setActiveTags([]);
              setQuery("");
              setActiveStyle(style);
            }}
          />
        ) : effectiveGroupBy ? (
          <GroupedIconGrid
            items={filtered}
            setsMeta={setsMeta}
            selectedKey={selected ? selected.key : null}
            favoriteKeys={favoritesSet}
            showLabels={tweaks.showLabels}
            fgColor={fgGridColor}
            tileMin={tileMin}
            onSelect={setSelectedKey}
            onToggleFav={toggleFav}
            onPickSet={(id) => {
              setActiveSet(id);
              setActiveGroup(null);
            }}
          />
        ) : (
          <IconGrid
            items={filtered}
            selectedKey={selected ? selected.key : null}
            favoriteKeys={favoritesSet}
            showLabels={tweaks.showLabels}
            fgColor={fgGridColor}
            tileMin={tileMin}
            onSelect={setSelectedKey}
            onToggleFav={toggleFav}
          />
        )}
      </main>

      {!isHome && selected && (
        <DetailPanel
          selected={selected}
          variations={variations}
          tweaks={tweaks}
          color={color}
          setColor={setColor}
          setLabel={setLabel}
          toggleFav={toggleFav}
          setQuery={setQuery}
          selectVariation={selectVariation}
          copyText={copyText}
        />
      )}

      <div className="statusbar">
        <span className="dot-ok" /> Ready
        <span>
          {icons.length} icons · {sets.length} sets · {favorites.length} favorites
        </span>
        <span className="statusbar-spacer" />
        <span>VibeIcons · PWA</span>
      </div>

      {toast && (
        <div className="toast-stack">
          <div className="toast">
            <Icon name="check" size={14} />
            {toast}
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal
          iconCount={icons.length}
          sources={sources}
          setsCount={sets.length}
          groupsMeta={groupsMeta}
          favoritesCount={favorites.length}
          bundledLoading={bundledLoading}
          onClose={() => setShowSettings(false)}
          onClearAll={clearAll}
          onLoadBundled={() => void loadBundledLibraries()}
        />
      )}
    </div>
  );
}
