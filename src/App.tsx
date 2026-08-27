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
  Project,
  ProjectExportSettings,
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
  deleteLibraryFromDb,
  getAllGroups,
  getAllIcons,
  getAllSets,
  getAllSources,
  openDb,
  putSource,
  renameLibraryInDb,
} from "./lib/db";
import { buildSearch, iconKey, normalizeImportedIcon } from "./lib/icons";
import {
  clearPresetInitialized,
  isPresetInitialized,
  loadPresetSources,
  markPresetInitialized,
  type PresetSource,
} from "./lib/preset";
import {
  collectFolderEntriesFromDataTransfer,
  importSvgFolderFromEntries,
  importSvgFolderFromFiles,
  normalizePath,
} from "./lib/svgFolderImport";
import { Icon } from "./components/Icon";
import { HierarchyTree } from "./components/HierarchyTree";
import { DetailPanel } from "./components/DetailPanel";
import { SettingsModal } from "./components/SettingsModal";
import { IconGrid } from "./components/IconGrid";
import { GroupedIconGrid } from "./components/GroupedIconGrid";
import { HomeView } from "./components/HomeView";
import { LibraryEmpty } from "./components/LibraryEmpty";
import { ProjectsSection } from "./components/ProjectsSection";
import { QuickCollectionPanel } from "./components/QuickCollectionPanel";
import { TileContextMenu } from "./components/TileContextMenu";
import { ProjectExportMenu } from "./components/ProjectExportMenu";
import { GitHubLink } from "./components/GitHubLink";

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
  // Cold-load outcome, consumed by the first-run preset import below.
  const [initialLoad, setInitialLoad] = useState({ done: false, hadData: false });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const opened = await openDb();
      if (cancelled) return;
      // No IndexedDB (private mode / blocked): still let the preset import run,
      // it just stays in memory for this session.
      if (!opened) {
        setInitialLoad({ done: true, hadData: false });
        return;
      }
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
      setInitialLoad({ done: true, hadData: effectiveIcons.length > 0 });
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

  // === Projects / Collections ===
  const [projects, setProjects] = useState<Project[]>(() =>
    readJson<Project[]>(STORAGE_KEY + ".projects", []),
  );
  const [activeProject, setActiveProject] = useState<string | null>(null);
  const [quickProjectId, setQuickProjectId] = useState<string | null>(() =>
    readJson<string | null>(STORAGE_KEY + ".quickProject", null),
  );
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [tileMenu, setTileMenu] = useState<{
    x: number;
    y: number;
    keys: string[];
  } | null>(null);
  const [exportProjectId, setExportProjectId] = useState<string | null>(null);
  const [exportLibrarySource, setExportLibrarySource] = useState<string | null>(null);
  const [dragKeys, setDragKeys] = useState<string[]>([]);

  useEffect(() => writeJson(STORAGE_KEY + ".projects", projects), [projects]);
  useEffect(() => {
    writeJson(STORAGE_KEY + ".quickProject", quickProjectId);
  }, [quickProjectId]);

  const toggleGroupExpand = useCallback((id: string | number) => {
    setExpandedGroups((prev) => ({ ...prev, [String(id)]: !prev[String(id)] }));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  // === Project mutators (depend on showToast) ===
  const newProjectId = () =>
    "p_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 6);

  const createProject = useCallback((name: string): string => {
    const id = newProjectId();
    setProjects((prev) => [...prev, { id, name, iconKeys: [] }]);
    return id;
  }, []);
  const renameProject = useCallback((id: string, name: string) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }, []);
  const deleteProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
    setActiveProject((cur) => (cur === id ? null : cur));
    setQuickProjectId((cur) => (cur === id ? null : cur));
    setExportProjectId((cur) => (cur === id ? null : cur));
  }, []);
  const addIconsToProject = useCallback(
    (projId: string, keys: string[]) => {
      if (!keys.length) return;
      let projName = "project";
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projId) return p;
          projName = p.name;
          const seen = new Set(p.iconKeys);
          const next = [...p.iconKeys];
          for (const k of keys) {
            if (!seen.has(k)) {
              seen.add(k);
              next.push(k);
            }
          }
          return { ...p, iconKeys: next };
        }),
      );
      showToast(
        `Added ${keys.length} icon${keys.length === 1 ? "" : "s"} to "${projName}"`,
      );
    },
    [showToast],
  );
  const removeIconsFromProject = useCallback((projId: string, keys: string[]) => {
    if (!keys.length) return;
    const ks = new Set(keys);
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id !== projId) return p;
        const restKeys = p.iconKeys.filter((k) => !ks.has(k));
        const aliasesSnapshot = p.iconAliases;
        let nextAliases: Record<string, string> | undefined = aliasesSnapshot;
        if (
          aliasesSnapshot &&
          keys.some((k) => k in aliasesSnapshot)
        ) {
          const copy = { ...aliasesSnapshot };
          for (const k of keys) delete copy[k];
          nextAliases = Object.keys(copy).length > 0 ? copy : undefined;
        }
        return { ...p, iconKeys: restKeys, iconAliases: nextAliases };
      }),
    );
  }, []);
  const clearProject = useCallback((projId: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === projId ? { ...p, iconKeys: [], iconAliases: undefined } : p,
      ),
    );
  }, []);
  const setProjectIconAlias = useCallback(
    (projId: string, iconKey: string, displayName: string) => {
      const ic = icons.find((i) => i.key === iconKey);
      const libraryName = ic?.name ?? "";
      const trimmed = displayName.trim();
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== projId) return p;
          const base = { ...(p.iconAliases ?? {}) };
          if (!trimmed || trimmed === libraryName) delete base[iconKey];
          else base[iconKey] = trimmed;
          const nextAliases =
            Object.keys(base).length > 0 ? base : undefined;
          return { ...p, iconAliases: nextAliases };
        }),
      );
    },
    [icons],
  );
  const createAndAddToProject = useCallback((name: string, keys: string[]) => {
    const id = newProjectId();
    setProjects((prev) => [
      ...prev,
      { id, name, iconKeys: [...new Set(keys)] },
    ]);
  }, []);
  const updateProjectExportSettings = useCallback(
    (id: string, patch: Partial<ProjectExportSettings>) => {
      setProjects((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          const cur = p.exportSettings;
          const next: ProjectExportSettings = {
            color: cur?.color ?? "#1A1D23",
            pngSize: cur?.pngSize ?? 256,
            pngPadding: cur?.pngPadding ?? 0,
            previewBg: cur?.previewBg ?? "checker",
            ...patch,
          };
          return { ...p, exportSettings: next };
        }),
      );
    },
    [],
  );

  const remapIconCompositeKey = useCallback((key: string, oldSrc: string, newSrc: string) => {
    const p = oldSrc + "::";
    return key.startsWith(p) ? newSrc + "::" + key.slice(p.length) : key;
  }, []);

  const renameLibrary = useCallback(
    (oldName: string, newName: string): boolean => {
      const trimmed = newName.trim();
      if (!trimmed || trimmed === oldName) return false;
      if (sources[trimmed]) {
        showToast(`A library named "${trimmed}" already exists`);
        return false;
      }
      if (!sources[oldName]) return false;

      const rk = (key: string) => remapIconCompositeKey(key, oldName, trimmed);
      const rid = (id: string | number | null): string | number | null => {
        if (id == null) return null;
        const s = String(id);
        return s.startsWith(oldName + ":") ? trimmed + ":" + s.slice(oldName.length + 1) : id;
      };

      const scopedPrefix = oldName + ":";
      const meta = sources[oldName];
      setIcons((prev) =>
        prev.map((ic) =>
          ic.source !== oldName
            ? ic
            : {
                ...ic,
                source: trimmed,
                key: rk(ic.key),
                search: buildSearch(ic.name, ic.tags, trimmed),
                set_id: rid(ic.set_id) as string | number | null,
              },
        ),
      );

      setSetsMeta((prev) => {
        const next: SetsMetaMap = {};
        for (const v of Object.values(prev)) {
          if (!String(v.id).startsWith(scopedPrefix)) next[String(v.id)] = v;
          else {
            const nv = {
              ...v,
              id: rid(v.id)!,
              group_id: rid(v.group_id),
              label: v.label === oldName ? trimmed : v.label,
            };
            next[String(nv.id)] = nv;
          }
        }
        return next;
      });

      setGroupsMeta((prev) => {
        const next: GroupsMetaMap = {};
        for (const v of Object.values(prev)) {
          if (!String(v.id).startsWith(scopedPrefix)) next[String(v.id)] = v;
          else {
            const nv = {
              ...v,
              id: rid(v.id)!,
              group_id: rid(v.group_id),
              label: v.label === oldName ? trimmed : v.label,
            };
            next[String(nv.id)] = nv;
          }
        }
        return next;
      });

      setSources((prev) => {
        const next = { ...prev };
        delete next[oldName];
        next[trimmed] = { name: trimmed, count: meta.count };
        return next;
      });

      setFavorites((prev) => prev.map(rk));
      setRecents((prev) => prev.map(rk));

      setProjects((prev) =>
        prev.map((p) => {
          const nextAliases = p.iconAliases
            ? Object.fromEntries(Object.entries(p.iconAliases).map(([k, v]) => [rk(k), v]))
            : undefined;
          return {
            ...p,
            iconKeys: p.iconKeys.map(rk),
            iconAliases:
              nextAliases && Object.keys(nextAliases).length > 0 ? nextAliases : undefined,
          };
        }),
      );

      setExpandedGroups((prev) => {
        const next: Record<string, boolean> = {};
        for (const [k, v] of Object.entries(prev)) {
          const nk = k.startsWith(scopedPrefix) ? trimmed + ":" + k.slice(oldName.length + 1) : k;
          next[nk] = v;
        }
        return next;
      });

      setActiveGroup((cur) =>
        cur != null && String(cur).startsWith(scopedPrefix) ? rid(cur)! : cur,
      );
      setActiveSet((cur) =>
        cur != null && String(cur).startsWith(scopedPrefix) ? rid(cur)! : cur,
      );

      const prefixKey = oldName + "::";
      setSelectedKey((cur) => (cur && cur.startsWith(prefixKey) ? rk(cur) : cur));
      setSelectedKeys((prev) => new Set([...prev].map(rk)));

      const db = dbRef.current;
      if (db) {
        void renameLibraryInDb(db, oldName, trimmed).catch((e) =>
          console.warn("Rename library DB sync failed", e),
        );
      }

      showToast(`Library renamed to "${trimmed}"`);
      setExportLibrarySource((cur) => (cur === oldName ? trimmed : cur));
      return true;
    },
    [sources, showToast, remapIconCompositeKey],
  );

  const deleteLibrary = useCallback(
    (sourceName: string) => {
      if (!sources[sourceName]) return;
      const prefix = sourceName + ":";
      const prefixKey = sourceName + "::";

      setExportLibrarySource((cur) => (cur === sourceName ? null : cur));

      setIcons((prev) => prev.filter((ic) => ic.source !== sourceName));

      setSetsMeta((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (k.startsWith(prefix)) delete next[k];
        }
        return next;
      });

      setGroupsMeta((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (k.startsWith(prefix)) delete next[k];
        }
        return next;
      });

      setSources((prev) => {
        const next = { ...prev };
        delete next[sourceName];
        return next;
      });

      setFavorites((prev) => prev.filter((k) => !k.startsWith(prefixKey)));
      setRecents((prev) => prev.filter((k) => !k.startsWith(prefixKey)));

      setProjects((prev) =>
        prev.map((p) => {
          const keys = p.iconKeys.filter((k) => !k.startsWith(prefixKey));
          const aliases = p.iconAliases
            ? Object.fromEntries(
                Object.entries(p.iconAliases).filter(([k]) => !k.startsWith(prefixKey)),
              )
            : undefined;
          return {
            ...p,
            iconKeys: keys,
            iconAliases:
              aliases && Object.keys(aliases).length > 0 ? aliases : undefined,
          };
        }),
      );

      setExpandedGroups((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(next)) {
          if (k.startsWith(prefix)) delete next[k];
        }
        return next;
      });

      setActiveGroup((cur) =>
        cur != null && String(cur).startsWith(prefix) ? null : cur,
      );
      setActiveSet((cur) =>
        cur != null && String(cur).startsWith(prefix) ? null : cur,
      );

      setSelectedKey((cur) => (cur && cur.startsWith(prefixKey) ? null : cur));
      setSelectedKeys((prev) => {
        const next = new Set<string>();
        for (const k of prev) {
          if (!k.startsWith(prefixKey)) next.add(k);
        }
        return next;
      });

      const db = dbRef.current;
      if (db) {
        void deleteLibraryFromDb(db, sourceName).catch((e) =>
          console.warn("Delete library DB failed", e),
        );
      }

      showToast(`Removed library "${sourceName}"`);
    },
    [sources, showToast],
  );

  // clearAll is defined further down so it can call loadPresetLibraries
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

  // When a project is active, replace nav-based filtering (favorites/recents)
  // with project membership. activeStyle / activeSet / activeGroup still apply
  // so the user can narrow within a project.
  const projectKeySet = useMemo<Set<string> | null>(() => {
    if (activeProject == null) return null;
    const proj = projects.find((p) => p.id === activeProject);
    return new Set(proj ? proj.iconKeys : []);
  }, [activeProject, projects]);

  const effectiveFilterSet = projectKeySet ?? navFilterSet;

  // Highlight icons that already live in the "quick project" (the project
  // targeted by double-click add). Lets the user spot already-added icons in
  // the main grid so they don't re-click them. When no quick project is set
  // — or the active view IS that project (every icon would be in it) — the
  // set is empty so tiles get no extra marker.
  const quickProjectKeySet = useMemo<Set<string>>(() => {
    if (!quickProjectId || quickProjectId === activeProject) return new Set();
    const proj = projects.find((p) => p.id === quickProjectId);
    return new Set(proj ? proj.iconKeys : []);
  }, [quickProjectId, activeProject, projects]);

  // baseFiltered: all filters except tag chips. Tag aggregation is computed
  // from this so toggling a tag doesn't make the other tags disappear.
  const baseFiltered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const out: IconRecord[] = [];
    for (let i = 0; i < icons.length; i++) {
      const ic = icons[i];
      if (effectiveFilterSet && !effectiveFilterSet.has(ic.key)) continue;
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
    effectiveFilterSet,
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

  // === Preset libraries ===
  // public/preset.json (checked into the repo) lists what the app initialises
  // itself with; by default it points at the generated Ant Design manifest in
  // public/libraries/index.json. Applied automatically on a cold start, and
  // manually from the empty-state CTA / the Settings modal.
  const [preset, setPreset] = useState<{ loaded: boolean; sources: PresetSource[] }>({
    loaded: false,
    sources: [],
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await loadPresetSources();
      if (!cancelled) setPreset({ loaded: true, sources: list });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [presetLoading, setPresetLoading] = useState(false);
  const loadPresetLibraries = useCallback(async (): Promise<number> => {
    setPresetLoading(true);
    try {
      // The manual buttons can fire before the preset.json fetch resolves.
      let entries = preset.sources;
      if (!preset.loaded) {
        entries = await loadPresetSources();
        setPreset({ loaded: true, sources: entries });
      }
      if (entries.length === 0) return 0;
      const taken = new Set<string>();
      let imported = 0;
      for (const entry of entries) {
        // Skip libraries whose source is already loaded so repeat clicks are
        // idempotent instead of producing "Ant Design Outlined (2)" duplicates.
        if (sources[entry.name]) continue;
        const r = await fetch(entry.url);
        if (!r.ok) {
          console.warn(`[preset] ${entry.name} → HTTP ${r.status}`);
          continue;
        }
        const text = await r.text();
        const result = handleImport(text, entry.name + ".json", {
          takenNames: taken,
          silent: true,
        });
        if (result) imported += result.imported;
      }
      if (imported > 0) showToast(`Loaded ${imported} preset icons`);
      return imported;
    } catch (e) {
      console.warn("Preset library load failed:", e);
      return 0;
    } finally {
      setPresetLoading(false);
    }
  }, [handleImport, preset, sources, showToast]);

  // First run: no local cache yet → import the preset once. Guarded by a
  // localStorage flag that survives the regular "Clear all data" (so an
  // intentionally emptied library stays empty) and is dropped only by the full
  // reset in Settings.
  const presetInitRef = useRef(false);
  useEffect(() => {
    if (!initialLoad.done || !preset.loaded || presetInitRef.current) return;
    presetInitRef.current = true;
    if (isPresetInitialized()) return;
    // Library predates preset.json (or was cleared by hand) — adopt as-is.
    if (initialLoad.hadData) {
      markPresetInitialized();
      return;
    }
    if (preset.sources.length === 0) return; // preset unreachable — retry next launch
    void loadPresetLibraries().then((imported) => {
      if (imported > 0) markPresetInitialized();
    });
  }, [initialLoad, preset, loadPresetLibraries]);

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
    setProjects([]);
    setActiveProject(null);
    setQuickProjectId(null);
    setSelectedKeys(new Set());
    setExportProjectId(null);
    setExportLibrarySource(null);
    setTileMenu(null);
    clearAllStorage();
    if (dbRef.current) void clearAllDb(dbRef.current);
    setShowSettings(false);
    showToast("All data cleared");
  }, [showToast]);

  // Full reset: wipe IndexedDB + localStorage *including* the preset flag, then
  // reload so the app comes up exactly like a fresh install (and re-imports the
  // preset). Mostly a testing affordance for the first-run path.
  const [resetting, setResetting] = useState(false);
  const resetEverything = useCallback(async () => {
    setResetting(true);
    try {
      clearAllStorage();
      clearPresetInitialized();
      const db = dbRef.current;
      if (db) {
        try {
          await clearAllDb(db);
        } catch (e) {
          console.warn("Full reset: DB clear failed", e);
        }
        db.close();
        dbRef.current = null;
      }
    } finally {
      window.location.reload();
    }
  }, []);

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

  const mergeSvgFolderImport = useCallback(
    (result: {
      sourceName: string;
      icons: IconRecord[];
      groups: GroupMeta[];
      sets: SetMeta[];
      skipped: number;
    }) => {
      const { sourceName, icons: newIcons, groups: newGroups, sets: newSets, skipped } =
        result;
      const sourceMeta: SourceMeta = { name: sourceName, count: newIcons.length };

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

      const db = dbRef.current;
      if (db) {
        void Promise.all([
          bulkPutIcons(db, newIcons),
          bulkPutSets(db, newSets),
          bulkPutGroups(db, newGroups),
          putSource(db, sourceMeta),
        ]).catch((e) => console.warn("DB persist failed", e));
      }

      showToast(
        `Imported ${newIcons.length} SVG as "${sourceName}"` +
          (skipped ? ` · ${skipped} skipped` : ""),
      );
    },
    [showToast],
  );

  const handleFolderImport = useCallback(
    async (fileList: FileList | null | undefined) => {
      if (!fileList?.length) return;
      const files = Array.from(fileList);
      const result = await importSvgFolderFromFiles(files, sources, icons);
      if (!result.ok) {
        showToast(result.message);
        return;
      }
      mergeSvgFolderImport(result);
    },
    [sources, icons, showToast, mergeSvgFolderImport],
  );

  const copyText = useCallback(
    (s: string, label = "SVG") => {
      void navigator.clipboard.writeText(s);
      showToast(`${label} copied`);
    },
    [showToast],
  );

  // === Tile interaction handlers ===
  const onTileSelect = useCallback(
    (key: string, e: React.MouseEvent) => {
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        setSelectedKeys((prev) => {
          const next = new Set(prev);
          if (next.has(key)) next.delete(key);
          else next.add(key);
          return next;
        });
      } else {
        setSelectedKey(key);
        setSelectedKeys(new Set());
      }
    },
    [],
  );
  const onTileActivate = useCallback(
    (key: string) => {
      if (quickProjectId) {
        addIconsToProject(quickProjectId, [key]);
      } else {
        toggleFav(key);
      }
    },
    [quickProjectId, addIconsToProject, toggleFav],
  );
  const onTileContext = useCallback(
    (key: string, x: number, y: number) => {
      // If RMB target isn't part of the multi-select, fall back to a single-icon menu.
      const keys = selectedKeys.has(key) ? [...selectedKeys] : [key];
      if (!selectedKeys.has(key)) setSelectedKey(key);
      setTileMenu({ x, y, keys });
    },
    [selectedKeys],
  );
  const onTileDragStart = useCallback(
    (key: string, e: React.DragEvent) => {
      const keys =
        selectedKeys.has(key) && selectedKeys.size > 1
          ? [...selectedKeys]
          : [key];
      setDragKeys(keys);
      e.dataTransfer.effectAllowed = "copy";
      try {
        e.dataTransfer.setData("text/plain", keys.join("\n"));
      } catch {
        /* ignore */
      }
    },
    [selectedKeys],
  );
  const onTileDragEnd = useCallback(() => {
    setDragKeys([]);
  }, []);

  const openBulkMenu = useCallback(
    (e: React.MouseEvent) => {
      if (selectedKeys.size === 0) return;
      setTileMenu({ x: e.clientX, y: e.clientY, keys: [...selectedKeys] });
    },
    [selectedKeys],
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
      } else if (e.key === "Escape") {
        if (selectedKeys.size > 0) setSelectedKeys(new Set());
        if (tileMenu) setTileMenu(null);
      } else if (
        (e.metaKey || e.ctrlKey) &&
        (e.key === "a" || e.key === "A") &&
        filtered.length > 0
      ) {
        e.preventDefault();
        setSelectedKeys(new Set(filtered.map((ic) => ic.key)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selected, toggleFav, selectedKeys, tileMenu]);

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
    <div
      className={
        "app" +
        (isHome || (!selected && projects.length === 0) ? " no-detail" : "")
      }
    >
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
          <label className="btn" style={{ cursor: "pointer" }} title="SVG files + optional .txt tags">
            <Icon name="folder" size={13} />
            Import folder
            <input
              id="vibe-folder-input"
              type="file"
              multiple
              hidden
              // Non-standard: folder picker (Chromium / Edge / Safari / Firefox)
              // @ts-expect-error webkitdirectory / directory not in InputHTMLAttributes
              webkitdirectory=""
              directory=""
              onChange={(e) => {
                void handleFolderImport(e.target.files);
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
                  setActiveProject(null);
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

        <ProjectsSection
          projects={projects}
          activeProject={activeProject}
          quickProjectId={quickProjectId}
          dragKeys={dragKeys}
          onSelectProject={(id) => {
            setActiveProject((cur) => (cur === id ? null : id));
            setSelectedKeys(new Set());
          }}
          onCreateProject={(name) => {
            createProject(name);
          }}
          onRenameProject={renameProject}
          onDeleteProject={deleteProject}
          onSetQuick={(id) => setQuickProjectId(id)}
          onExportProject={(id) => {
            setExportLibrarySource(null);
            setExportProjectId(id);
          }}
          onDropOnProject={(id, keys) => addIconsToProject(id, keys)}
        />

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
            sources={sources}
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
            onOpenLibrary={(src) => {
              setActiveProject(null);
              setActiveGroup(src + ":__lib");
              setActiveSet(null);
              setActiveNav("all");
            }}
            onRenameLibrary={renameLibrary}
            onExportLibrary={(src) => {
              setExportProjectId(null);
              setExportLibrarySource(src);
            }}
            onDeleteLibrary={deleteLibrary}
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
            // Only highlight for actual file drags so internal tile drags
            // (text/plain) don't make this zone flash.
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={async (e) => {
            if (!e.dataTransfer.types.includes("Files")) return;
            e.preventDefault();
            setDragging(false);
            const dt = e.dataTransfer;

            const collected = await collectFolderEntriesFromDataTransfer(dt);
            if (collected?.length) {
              const svgEntries = collected.filter((x) => /\.svg$/i.test(x.file.name));
              const roots = new Set(
                collected
                  .map((x) => normalizePath(x.relativePath).split("/")[0])
                  .filter(Boolean),
              );
              if (svgEntries.length > 0 && roots.size === 1) {
                const result = await importSvgFolderFromEntries(collected, sources, icons);
                if (!result.ok) {
                  showToast(result.message);
                  return;
                }
                mergeSvgFolderImport(result);
                return;
              }
            }

            onFiles(dt.files);
          }}
          onClick={() => document.getElementById("vibe-file-input")?.click()}
        >
          <Icon name="upload" size={16} />
          <div className="dnd-zone-title">Drop JSON or SVG folder</div>
          <div className="dnd-zone-hint">
            or click to browse · folders via drag from Explorer/Finder
          </div>
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

        {!isHome && !isEmpty && activeProject != null && (() => {
          const proj = projects.find((p) => p.id === activeProject);
          if (!proj) return null;
          return (
            <div className="proj-banner">
              <Icon name="folder" size={12} />
              <span className="proj-banner-name">{proj.name}</span>
              <span className="proj-banner-count">{proj.iconKeys.length} icons</span>
              <button
                type="button"
                className="btn btn-ghost proj-banner-btn"
                onClick={() => {
                  setExportLibrarySource(null);
                  setExportProjectId(proj.id);
                }}
                title="Export"
              >
                <Icon name="download" size={11} /> Export
              </button>
              <button
                type="button"
                className="btn btn-ghost proj-banner-btn"
                onClick={() => setActiveProject(null)}
                title="Close project view"
              >
                <Icon name="x" size={11} />
              </button>
            </div>
          );
        })()}

        {!isHome && selectedKeys.size > 0 && (
          <div className="bulk-bar">
            <span>
              <b>{selectedKeys.size}</b> selected
            </span>
            <button
              type="button"
              className="btn btn-ghost proj-banner-btn"
              onClick={openBulkMenu}
            >
              Add to project…
            </button>
            <button
              type="button"
              className="btn btn-ghost proj-banner-btn"
              onClick={() => setSelectedKeys(new Set())}
            >
              Clear
            </button>
          </div>
        )}

        {isEmpty ? (
          <LibraryEmpty
            loading={presetLoading}
            presetSourceNames={preset.sources.map((p) => p.name)}
            onLoadPreset={() => void loadPresetLibraries()}
            onPickFile={() => document.getElementById("vibe-file-input")?.click()}
            onPickFolder={() => document.getElementById("vibe-folder-input")?.click()}
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
            selectedKeys={selectedKeys}
            favoriteKeys={favoritesSet}
            projectKeys={quickProjectKeySet}
            showLabels={tweaks.showLabels}
            fgColor={fgGridColor}
            tileMin={tileMin}
            onSelect={onTileSelect}
            onActivate={onTileActivate}
            onContext={onTileContext}
            onDragStart={onTileDragStart}
            onDragEnd={onTileDragEnd}
            onPickSet={(id) => {
              setActiveSet(id);
              setActiveGroup(null);
            }}
          />
        ) : (
          <IconGrid
            items={filtered}
            selectedKey={selected ? selected.key : null}
            selectedKeys={selectedKeys}
            favoriteKeys={favoritesSet}
            projectKeys={quickProjectKeySet}
            showLabels={tweaks.showLabels}
            fgColor={fgGridColor}
            tileMin={tileMin}
            onSelect={onTileSelect}
            onActivate={onTileActivate}
            onContext={onTileContext}
            onDragStart={onTileDragStart}
            onDragEnd={onTileDragEnd}
          />
        )}
      </main>

      {!isHome && (selected || projects.length > 0) && (() => {
        const quickProj = projects.find((p) => p.id === quickProjectId) ?? null;
        const quickIcons = quickProj
          ? quickProj.iconKeys
              .map((k) => {
                const idx = aggregates.keyToIndex.get(k);
                return idx != null ? icons[idx] : null;
              })
              .filter((x): x is IconRecord => x !== null)
          : [];
        return (
          <aside className={"detail" + (selected ? "" : " detail-quick-only")}>
            {projects.length > 0 && (
              <QuickCollectionPanel
                project={quickProj}
                icons={quickIcons}
                projects={projects}
                theme={tweaks.theme}
                onSetIconAlias={(iconKey, name) => {
                  if (quickProj) setProjectIconAlias(quickProj.id, iconKey, name);
                }}
                onRemove={(k) => {
                  if (quickProj) removeIconsFromProject(quickProj.id, [k]);
                }}
                onClear={(id) => {
                  if (confirm("Clear this project?")) clearProject(id);
                }}
                onExport={(id) => {
                  setExportLibrarySource(null);
                  setExportProjectId(id);
                }}
                onSetQuick={(id) => setQuickProjectId(id)}
                onOpenProject={(id) => {
                  setActiveProject(id);
                  setActiveSet(null);
                  setActiveGroup(null);
                  setActiveStyle(null);
                  setActiveTags([]);
                  setActiveNav("all");
                  setSelectedKeys(new Set());
                }}
              />
            )}
            {selected && (
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
          </aside>
        );
      })()}

      <div className="statusbar">
        <span className="dot-ok" /> Ready
        <span>
          {icons.length} icons · {sets.length} sets · {favorites.length} favorites
        </span>
        <span className="statusbar-spacer" />
        <span>VibeIcons · PWA</span>
        <GitHubLink />
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
          presetSourceNames={preset.sources.map((p) => p.name)}
          presetLoading={presetLoading}
          resetting={resetting}
          onClose={() => setShowSettings(false)}
          onClearAll={clearAll}
          onLoadPreset={() => void loadPresetLibraries()}
          onFullReset={() => void resetEverything()}
        />
      )}

      {tileMenu && (
        <TileContextMenu
          x={tileMenu.x}
          y={tileMenu.y}
          count={tileMenu.keys.length}
          projects={projects}
          quickProjectId={quickProjectId}
          isInProject={activeProject != null}
          onAddTo={(pid) => addIconsToProject(pid, tileMenu.keys)}
          onCreateAndAdd={(name) => createAndAddToProject(name, tileMenu.keys)}
          onRemoveFrom={() => {
            if (activeProject) removeIconsFromProject(activeProject, tileMenu.keys);
          }}
          onSetQuick={(id) => setQuickProjectId(id)}
          onClose={() => setTileMenu(null)}
        />
      )}

      {exportProjectId && (() => {
        const proj = projects.find((p) => p.id === exportProjectId);
        if (!proj) return null;
        const projIcons = proj.iconKeys
          .map((k) => {
            const idx = aggregates.keyToIndex.get(k);
            return idx != null ? icons[idx] : null;
          })
          .filter((x): x is IconRecord => x !== null);
        return (
          <ProjectExportMenu
            project={proj}
            icons={projIcons}
            iconAliases={proj.iconAliases}
            settings={proj.exportSettings}
            onSettingsChange={(patch) =>
              updateProjectExportSettings(proj.id, patch)
            }
            showToast={showToast}
            onClose={() => setExportProjectId(null)}
          />
        );
      })()}

      {exportLibrarySource &&
        (() => {
          const libIcons = icons.filter((i) => i.source === exportLibrarySource);
          const synthetic: Project = {
            id: "__library_export__",
            name: exportLibrarySource,
            iconKeys: libIcons.map((i) => i.key),
          };
          return (
            <ProjectExportMenu
              project={synthetic}
              icons={libIcons}
              iconAliases={undefined}
              settings={undefined}
              onSettingsChange={() => {}}
              showToast={showToast}
              onClose={() => setExportLibrarySource(null)}
            />
          );
        })()}
    </div>
  );
}
