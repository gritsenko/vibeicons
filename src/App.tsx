import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  GroupsMetaMap,
  IconRecord,
  ImportFile,
  SetsMetaMap,
  SourcesMap,
  Tweaks,
} from "./types";
import { SEED_ICONS } from "./seed";
import {
  STORAGE_KEY,
  clearAllStorage,
  deleteIconsFromDb,
  loadIconsFromDb,
  openDb,
  readJson,
  saveIconsToDb,
  writeJson,
} from "./lib/storage";
import { Icon } from "./components/Icon";
import { RenderedIcon } from "./components/RenderedIcon";
import { HierarchyTree } from "./components/HierarchyTree";
import { DetailPanel } from "./components/DetailPanel";
import { SettingsModal } from "./components/SettingsModal";

const NAV_ITEMS = [
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

function normalizeIcon(it: unknown, sourceName: string | null): IconRecord | null {
  if (!it || typeof it !== "object") return null;
  const obj = it as Record<string, unknown>;
  if (!obj.name || !obj.content) return null;
  let tags: string;
  if (Array.isArray(obj.tags)) tags = obj.tags.join(",");
  else if (obj.tags == null) tags = "";
  else tags = String(obj.tags);
  return {
    name: String(obj.name),
    content: String(obj.content),
    style: (obj.style as string) || "other",
    width: Number(obj.width) || 48,
    height: Number(obj.height) || 48,
    set_id: (obj.set_id as string | number | null) ?? null,
    tags,
    source: sourceName,
  };
}

export function App() {
  // Tweaks
  const [tweaks, setTweaks] = useState<Tweaks>(() =>
    readJson<Tweaks>(STORAGE_KEY + ".tweaks", TWEAK_DEFAULTS),
  );
  const setTweak = <K extends keyof Tweaks>(key: K, value: Tweaks[K]) =>
    setTweaks((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    writeJson(STORAGE_KEY + ".tweaks", tweaks);
  }, [tweaks]);

  // Data
  const [icons, setIcons] = useState<IconRecord[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY + ".icons");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed as IconRecord[];
      }
    } catch {
      /* ignore */
    }
    return SEED_ICONS;
  });
  const [setsMeta, setSetsMeta] = useState<SetsMetaMap>(() =>
    readJson<SetsMetaMap>(STORAGE_KEY + ".setsMeta", {}),
  );
  const [groupsMeta, setGroupsMeta] = useState<GroupsMetaMap>(() =>
    readJson<GroupsMetaMap>(STORAGE_KEY + ".groupsMeta", {}),
  );
  const [sources, setSources] = useState<SourcesMap>(() =>
    readJson<SourcesMap>(STORAGE_KEY + ".sources", {}),
  );
  const [favorites, setFavorites] = useState<string[]>(() =>
    readJson<string[]>(STORAGE_KEY + ".favs", []),
  );
  const [recents, setRecents] = useState<string[]>(() =>
    readJson<string[]>(STORAGE_KEY + ".recents", []),
  );

  // Persist
  const idbRef = useRef<IDBDatabase | null>(null);
  useEffect(() => {
    let cancelled = false;
    void openDb().then(async (db) => {
      if (cancelled || !db) return;
      idbRef.current = db;
      const fromDb = await loadIconsFromDb(db);
      if (fromDb) setIcons(fromDb);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveIconsToDb(idbRef.current, icons);
  }, [icons]);
  useEffect(() => writeJson(STORAGE_KEY + ".setsMeta", setsMeta), [setsMeta]);
  useEffect(() => writeJson(STORAGE_KEY + ".groupsMeta", groupsMeta), [groupsMeta]);
  useEffect(() => writeJson(STORAGE_KEY + ".sources", sources), [sources]);
  useEffect(() => writeJson(STORAGE_KEY + ".favs", favorites), [favorites]);
  useEffect(() => writeJson(STORAGE_KEY + ".recents", recents), [recents]);

  // UI state
  const [query, setQuery] = useState("");
  const [activeNav, setActiveNav] = useState<NavKey>("all");
  const [activeSet, setActiveSet] = useState<string | number | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | number | null>(null);
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const [activeStyle, setActiveStyle] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [color, setColor] = useState("#F7F7F7");
  const [toast, setToast] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupExpand = useCallback((id: string | number) => {
    setExpandedGroups((prev) => ({ ...prev, [String(id)]: !prev[String(id)] }));
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  const clearAll = useCallback(() => {
    setIcons(SEED_ICONS);
    setSetsMeta({});
    setGroupsMeta({});
    setSources({});
    setFavorites([]);
    setRecents([]);
    setActiveSet(null);
    setActiveGroup(null);
    setActiveSource(null);
    setActiveStyle(null);
    setActiveNav("all");
    clearAllStorage();
    deleteIconsFromDb(idbRef.current);
    setShowSettings(false);
    showToast("All data cleared");
  }, [showToast]);

  // Theme & accent
  useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.style.setProperty("--accent", tweaks.accent);
    document.documentElement.style.setProperty("--accent-strong", tweaks.accent);
    document.documentElement.style.setProperty("--accent-soft", tweaks.accent + "26");
  }, [tweaks.theme, tweaks.density, tweaks.accent]);

  // Aggregations
  const sets = useMemo(() => {
    const m = new Map<string | number, number>();
    icons.forEach((i) => {
      const k: string | number = i.set_id ?? "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    });
    return [...m.entries()].sort((a, b) => {
      const la = setsMeta[String(a[0])]?.label ?? "Set " + a[0];
      const lb = setsMeta[String(b[0])]?.label ?? "Set " + b[0];
      return la.localeCompare(lb);
    });
  }, [icons, setsMeta]);

  const setLabel = useCallback(
    (id: string | number | null) => setsMeta[String(id)]?.label ?? "Set " + id,
    [setsMeta],
  );

  const styles = useMemo(() => {
    const m = new Map<string, number>();
    icons.forEach((i) => m.set(i.style || "other", (m.get(i.style || "other") ?? 0) + 1));
    return [...m.entries()];
  }, [icons]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let allowedSetIds: Set<string | number> | null = null;
    if (activeGroup != null) {
      allowedSetIds = new Set();
      const collect = (gid: string | number) => {
        Object.values(setsMeta).forEach((s) => {
          if (s.group_id === gid) allowedSetIds!.add(s.id);
        });
        Object.values(groupsMeta).forEach((g) => {
          if (g.group_id === gid) collect(g.id);
        });
      };
      collect(activeGroup);
    }
    return icons.filter((i) => {
      const favKey = (i.source ?? "") + "::" + i.name;
      if (activeNav === "favorites" && !favorites.includes(favKey)) return false;
      if (activeNav === "recents" && !recents.includes(favKey)) return false;
      if (activeSource != null && i.source !== activeSource) return false;
      if (activeSet != null && i.set_id !== activeSet) return false;
      if (allowedSetIds && (i.set_id == null || !allowedSetIds.has(i.set_id))) return false;
      if (activeStyle != null && i.style !== activeStyle) return false;
      if (!q) return true;
      const hay = (i.name + " " + (i.tags ?? "") + " " + (i.source ?? "")).toLowerCase();
      return hay.includes(q);
    });
  }, [
    icons,
    query,
    activeNav,
    activeSet,
    activeGroup,
    activeSource,
    activeStyle,
    favorites,
    recents,
    setsMeta,
    groupsMeta,
  ]);

  const selected = filtered[selectedIdx] ?? filtered[0] ?? null;

  useEffect(() => {
    if (selectedIdx >= filtered.length) setSelectedIdx(0);
  }, [filtered.length, selectedIdx]);

  // Track recents
  useEffect(() => {
    if (!selected) return;
    const key = (selected.source ?? "") + "::" + selected.name;
    setRecents((prev) => [key, ...prev.filter((n) => n !== key)].slice(0, 24));
  }, [selected?.name, selected?.source]);

  const toggleFav = useCallback((key: string) => {
    setFavorites((prev) => (prev.includes(key) ? prev.filter((n) => n !== key) : [...prev, key]));
  }, []);

  const handleImport = useCallback(
    (text: string, fileName?: string) => {
      try {
        const parsed = JSON.parse(text) as ImportFile | unknown[];
        const list: unknown[] = Array.isArray(parsed)
          ? parsed
          : Array.isArray((parsed as ImportFile).icons)
            ? ((parsed as ImportFile).icons as unknown[])
            : [];
        if (!list.length) throw new Error("No icons array found");

        let sourceName = fileName ? fileName.replace(/\.json$/i, "") : "Imported";
        // ensure unique source name
        if (sources[sourceName]) {
          let n = 2;
          while (sources[sourceName + " (" + n + ")"]) n++;
          sourceName = sourceName + " (" + n + ")";
        }
        const ns = (id: string | number | null | undefined): string | null =>
          id == null ? null : sourceName + ":" + id;

        const seen = new Set<string>();
        const merged = [...icons];
        let added = 0;
        let skipped = 0;
        list.forEach((it) => {
          const norm = normalizeIcon(it, sourceName);
          if (!norm) {
            skipped++;
            return;
          }
          if (seen.has(norm.name)) {
            skipped++;
            return;
          }
          seen.add(norm.name);
          norm.set_id = ns(norm.set_id);
          merged.push(norm);
          added++;
        });

        const libraryGroupId = sourceName + ":__lib";
        const newGroups: GroupsMetaMap = { ...groupsMeta };
        newGroups[libraryGroupId] = {
          id: libraryGroupId,
          label: sourceName,
          group_id: null,
        };

        const newSets: SetsMetaMap = { ...setsMeta };
        const fileObj = !Array.isArray(parsed) ? (parsed as ImportFile) : null;
        if (fileObj?.sets && Array.isArray(fileObj.sets)) {
          fileObj.sets.forEach((s) => {
            if (s && s.id != null) {
              const nid = ns(s.id);
              if (nid == null) return;
              const parent = s.group_id != null ? ns(s.group_id) : libraryGroupId;
              newSets[String(nid)] = {
                id: nid,
                label: s.label ?? "Set " + s.id,
                group_id: parent,
              };
            }
          });
        }
        if (fileObj?.groups && Array.isArray(fileObj.groups)) {
          fileObj.groups.forEach((g) => {
            if (g && g.id != null) {
              const nid = ns(g.id);
              if (nid == null) return;
              const parent = g.group_id != null ? ns(g.group_id) : libraryGroupId;
              newGroups[String(nid)] = {
                id: nid,
                label: g.label ?? "Group " + g.id,
                group_id: parent,
              };
            }
          });
        }
        setSetsMeta(newSets);
        setGroupsMeta(newGroups);
        setSources((prev) => ({
          ...prev,
          [sourceName]: { name: sourceName, count: added },
        }));
        setIcons(merged);
        showToast(
          `Imported ${added} icons as "${sourceName}"` + (skipped ? ` · ${skipped} skipped` : ""),
        );
      } catch (e) {
        console.error("Import failed:", e);
        showToast("Invalid JSON: " + (e instanceof Error ? e.message : String(e)));
      }
    },
    [icons, sources, setsMeta, groupsMeta, showToast],
  );

  const onFile = useCallback(
    (file: File) => {
      const r = new FileReader();
      r.onload = () => handleImport(String(r.result), file.name);
      r.readAsText(file);
    },
    [handleImport],
  );

  const copyText = useCallback(
    (s: string, label = "SVG") => {
      void navigator.clipboard.writeText(s);
      showToast(`${label} copied`);
    },
    [showToast],
  );

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowRight") setSelectedIdx((i) => Math.min(filtered.length - 1, i + 1));
      else if (e.key === "ArrowLeft") setSelectedIdx((i) => Math.max(0, i - 1));
      else if (e.key === "/") {
        e.preventDefault();
        document.querySelector<HTMLInputElement>(".search-bar input")?.focus();
      } else if (e.key === "f" && selected) {
        toggleFav((selected.source ?? "") + "::" + selected.name);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered, selected, toggleFav]);

  const variations = useMemo(
    () =>
      selected
        ? icons.filter((i) => i.name === selected.name && i.source !== selected.source)
        : [],
    [icons, selected],
  );

  const selectVariation = useCallback(
    (v: IconRecord) => {
      const idx = filtered.findIndex((f) => f.name === v.name && f.source === v.source);
      if (idx >= 0) {
        setSelectedIdx(idx);
      } else {
        setActiveNav("all");
        setActiveSet(null);
        setActiveGroup(null);
        setActiveSource(null);
        setActiveStyle(null);
        setQuery("");
        setTimeout(() => {
          const idx2 = icons.findIndex((f) => f.name === v.name && f.source === v.source);
          if (idx2 >= 0) setSelectedIdx(idx2);
        }, 0);
      }
    },
    [filtered, icons],
  );

  const fgGridColor = tweaks.theme === "dark" ? "#e6e8ec" : "#1a1d23";

  return (
    <div className={"app" + (selected ? "" : " no-detail")}>
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">V</div>
          <span>VibeIcons</span>
        </div>
        <div className="search-bar">
          <Icon name="search" size={14} />
          <input
            placeholder="Search by name or tag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="kbd">/</span>
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
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onFile(f);
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
                  : icons.length;
            return (
              <div
                key={n.key}
                className={
                  "side-item" +
                  (activeNav === n.key && activeSet == null && activeStyle == null
                    ? " active"
                    : "")
                }
                onClick={() => {
                  setActiveNav(n.key);
                  setActiveSet(null);
                  setActiveStyle(null);
                }}
              >
                <Icon name={n.icon} size={14} />
                <span>{n.label}</span>
                <span className="side-count">{count}</span>
              </div>
            );
          })}
        </div>

        <div className="side-divider" />

        {Object.keys(sources).length > 0 && (
          <div className="side-section">
            <div className="side-label">
              Sources <span className="count">{Object.keys(sources).length}</span>
            </div>
            {Object.values(sources).map((s) => (
              <div
                key={s.name}
                className={"side-item" + (activeSource === s.name ? " active" : "")}
                onClick={() => {
                  setActiveSource(activeSource === s.name ? null : s.name);
                  setActiveNav("all");
                }}
                title={s.name}
              >
                <Icon name="inbox" size={14} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {s.name}
                </span>
                <span className="side-count">{s.count}</span>
              </div>
            ))}
          </div>
        )}

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
            const f = e.dataTransfer.files[0];
            if (f) onFile(f);
          }}
          onClick={() => document.getElementById("vibe-file-input")?.click()}
        >
          <Icon name="upload" size={16} />
          <div className="dnd-zone-title">Drop JSON here</div>
          <div className="dnd-zone-hint">or click to browse</div>
        </div>
      </aside>

      <main className="main">
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

          <div className="toolbar-group">
            {sets.slice(0, 4).map(([id]) => (
              <button
                key={String(id)}
                className={"chip" + (activeSet === id ? " active" : "")}
                onClick={() => setActiveSet(activeSet === id ? null : id)}
                title={setLabel(id)}
              >
                <Icon name="folder" size={11} />
                {setLabel(id)}
              </button>
            ))}
          </div>

          <div className="toolbar-spacer" />

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

        <div className="grid-wrap">
          {filtered.length === 0 ? (
            <div className="empty-state">
              <Icon name="inbox" size={40} />
              <h3>No icons match</h3>
              <p>Try a different search or filter, or import a JSON file with icon definitions.</p>
            </div>
          ) : (
            <div className="grid">
              {filtered.map((ic, i) => {
                const isSel =
                  selected != null && selected.name === ic.name && selected.source === ic.source;
                const favKey = (ic.source ?? "") + "::" + ic.name;
                return (
                  <div
                    key={favKey + "::" + i}
                    className={
                      "tile" +
                      (isSel ? " selected" : "") +
                      (favorites.includes(favKey) ? " is-fav" : "") +
                      (tweaks.showLabels ? " show-label" : "")
                    }
                    onClick={() => setSelectedIdx(i)}
                    onDoubleClick={() => toggleFav(favKey)}
                    title={ic.name + (ic.source ? " · " + ic.source : "")}
                  >
                    <RenderedIcon icon={ic} size={null} color={fgGridColor} />
                    <span className="tile-fav">
                      <Icon name="star" size={11} />
                    </span>
                    <span className="tile-label">{ic.name}</span>
                    {ic.source && <span className="tile-source">{ic.source}</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

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
          onClose={() => setShowSettings(false)}
          onClearAll={clearAll}
        />
      )}
    </div>
  );
}
