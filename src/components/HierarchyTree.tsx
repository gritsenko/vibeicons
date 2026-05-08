import { useEffect, useState, type ReactNode } from "react";
import type { GroupsMetaMap, SetsMetaMap, GroupMeta, SetMeta, SourcesMap } from "../types";
import { Icon } from "./Icon";
import { librarySourceForScopedId } from "../lib/sourceScope";

interface Props {
  groupsMeta: GroupsMetaMap;
  setsMeta: SetsMetaMap;
  sets: Array<[string | number, number]>;
  expandedGroups: Record<string, boolean>;
  toggleGroupExpand: (id: string | number) => void;
  activeGroup: string | number | null;
  activeSet: string | number | null;
  onPickGroup: (id: string | number) => void;
  onPickSet: (id: string | number) => void;
  sources: SourcesMap;
  onOpenLibrary: (sourceName: string) => void;
  onRenameLibrary: (from: string, to: string) => boolean;
  onExportLibrary: (sourceName: string) => void;
  onDeleteLibrary: (sourceName: string) => void;
}

export function HierarchyTree({
  groupsMeta,
  setsMeta,
  sets,
  expandedGroups,
  toggleGroupExpand,
  activeGroup,
  activeSet,
  onPickGroup,
  onPickSet,
  sources,
  onOpenLibrary,
  onRenameLibrary,
  onExportLibrary,
  onDeleteLibrary,
}: Props) {
  const setCount = new Map<string | number, number>(sets);

  const [menu, setMenu] = useState<{
    x: number;
    y: number;
    sourceName: string;
    rowId: string;
  } | null>(null);
  const [renameRowKey, setRenameRowKey] = useState<string | null>(null);
  const [renameSourceName, setRenameSourceName] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  const commitLibRename = () => {
    if (!renameRowKey || !renameSourceName) return;
    const v = renameValue.trim();
    if (!v || v === renameSourceName) {
      setRenameRowKey(null);
      setRenameSourceName(null);
      return;
    }
    if (onRenameLibrary(renameSourceName, v)) {
      setRenameRowKey(null);
      setRenameSourceName(null);
    }
  };

  const childGroups = new Map<string | number | null, GroupMeta[]>();
  Object.values(groupsMeta).forEach((g) => {
    const p = g.group_id ?? null;
    if (!childGroups.has(p)) childGroups.set(p, []);
    childGroups.get(p)!.push(g);
  });

  const childSets = new Map<string | number | null, SetMeta[]>();
  Object.values(setsMeta).forEach((s) => {
    const p = s.group_id ?? null;
    if (!childSets.has(p)) childSets.set(p, []);
    childSets.get(p)!.push(s);
  });

  const orphanSetIds: Array<string | number> = [];
  sets.forEach(([id]) => {
    if (!setsMeta[String(id)]) orphanSetIds.push(id);
  });

  const countTotal = (gid: string | number): number => {
    let total = 0;
    (childSets.get(gid) ?? []).forEach((s) => {
      total += setCount.get(s.id) ?? 0;
    });
    (childGroups.get(gid) ?? []).forEach((sg) => {
      total += countTotal(sg.id);
    });
    return total;
  };

  function renderGroup(g: GroupMeta, depth: number): ReactNode {
    const expanded = expandedGroups[String(g.id)] === true;
    const subgroups = (childGroups.get(g.id) ?? [])
      .slice()
      .sort((a, b) => (a.label || "").localeCompare(b.label || ""));
    const groupSets = (childSets.get(g.id) ?? [])
      .slice()
      .sort((a, b) => (a.label || "").localeCompare(b.label || ""));
    const total = countTotal(g.id);
    if (total === 0 && subgroups.length === 0 && groupSets.length === 0) return null;

    const libSource = librarySourceForScopedId(g.id, sources);

    if (
      String(g.id).endsWith(":__lib") &&
      groupSets.length === 0 &&
      subgroups.length === 1 &&
      (subgroups[0].label || "") === (g.label || "")
    ) {
      return renderGroup(subgroups[0], depth);
    }

    const rowKey = String(g.id);

    return (
      <div key={"g" + g.id}>
        <div
          className={"side-item tree-group" + (activeGroup === g.id ? " active" : "")}
          style={{ paddingLeft: 12 + depth * 12 }}
          onContextMenu={(e) => {
            if (!libSource) return;
            e.preventDefault();
            e.stopPropagation();
            setMenu({
              x: e.clientX,
              y: e.clientY,
              sourceName: libSource,
              rowId: rowKey,
            });
          }}
        >
          <button
            className="tree-twirl"
            onClick={(e) => {
              e.stopPropagation();
              toggleGroupExpand(g.id);
            }}
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              style={{
                transform: expanded ? "rotate(90deg)" : "rotate(0)",
                transition: "transform .12s",
              }}
            >
              <path d="M3 2l4 3-4 3z" fill="currentColor" />
            </svg>
          </button>
          {renameRowKey === rowKey ? (
            <input
              autoFocus
              className="proj-rename-input tree-rename-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitLibRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitLibRename();
                else if (e.key === "Escape") {
                  setRenameRowKey(null);
                  setRenameSourceName(null);
                }
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="tree-label" onClick={() => onPickGroup(g.id)} title={g.label}>
              {g.label}
            </span>
          )}
          <span className="side-count">{total}</span>
        </div>
        {expanded && (
          <div>
            {subgroups.map((sg) => renderGroup(sg, depth + 1))}
            {groupSets.map((s) => {
              const c = setCount.get(s.id) ?? 0;
              if (!c) return null;
              const sRowKey = String(s.id);
              const setLibSource = librarySourceForScopedId(s.id, sources);
              return (
                <div
                  key={"s" + s.id}
                  className={"side-item tree-set" + (activeSet === s.id ? " active" : "")}
                  style={{ paddingLeft: 12 + (depth + 1) * 12 + 14 }}
                  onClick={() => onPickSet(s.id)}
                  onContextMenu={(e) => {
                    if (!setLibSource) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setMenu({
                      x: e.clientX,
                      y: e.clientY,
                      sourceName: setLibSource,
                      rowId: sRowKey,
                    });
                  }}
                  title={s.label}
                >
                  <Icon name="folder" size={12} />
                  {renameRowKey === sRowKey ? (
                    <input
                      autoFocus
                      className="proj-rename-input tree-rename-input"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={commitLibRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitLibRename();
                        else if (e.key === "Escape") {
                          setRenameRowKey(null);
                          setRenameSourceName(null);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {s.label}
                    </span>
                  )}
                  <span className="side-count">{c}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const rootGroups = (childGroups.get(null) ?? [])
    .slice()
    .sort((a, b) => (a.label || "").localeCompare(b.label || ""));
  const rootSets = (childSets.get(null) ?? [])
    .filter((s) => (setCount.get(s.id) ?? 0) > 0)
    .sort((a, b) => (a.label || "").localeCompare(b.label || ""));

  return (
    <div>
      {rootGroups.map((g) => renderGroup(g, 0))}
      {rootSets.map((s) => {
        const rsRowKey = String(s.id);
        const rsLib = librarySourceForScopedId(s.id, sources);
        return (
          <div
            key={"rs" + s.id}
            className={"side-item tree-set" + (activeSet === s.id ? " active" : "")}
            style={{ paddingLeft: 26 }}
            onClick={() => onPickSet(s.id)}
            onContextMenu={(e) => {
              if (!rsLib) return;
              e.preventDefault();
              e.stopPropagation();
              setMenu({
                x: e.clientX,
                y: e.clientY,
                sourceName: rsLib,
                rowId: rsRowKey,
              });
            }}
            title={s.label}
          >
            <Icon name="folder" size={12} />
            {renameRowKey === rsRowKey ? (
              <input
                autoFocus
                className="proj-rename-input tree-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitLibRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitLibRename();
                  else if (e.key === "Escape") {
                    setRenameRowKey(null);
                    setRenameSourceName(null);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.label}
              </span>
            )}
            <span className="side-count">{setCount.get(s.id) ?? 0}</span>
          </div>
        );
      })}
      {orphanSetIds.map((id) => (
        <div
          key={"orphan" + id}
          className={"side-item tree-set" + (activeSet === id ? " active" : "")}
          style={{ paddingLeft: 26 }}
          onClick={() => onPickSet(id)}
        >
          <Icon name="folder" size={12} />
          <span>Set {id}</span>
          <span className="side-count">{setCount.get(id) ?? 0}</span>
        </div>
      ))}

      {menu &&
        (() => {
          const src = menu.sourceName;
          return (
            <div
              className="ctx-menu"
              style={{ left: menu.x, top: menu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ctx-header">{src}</div>
              <div className="ctx-divider" />
              <div
                className="ctx-item"
                onClick={() => {
                  onOpenLibrary(src);
                  setMenu(null);
                }}
              >
                <Icon name="folder" size={11} />
                <span>Open library</span>
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  setRenameRowKey(menu.rowId);
                  setRenameSourceName(src);
                  setRenameValue(src);
                  setMenu(null);
                }}
              >
                <Icon name="settings" size={11} />
                <span>Rename…</span>
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  onExportLibrary(src);
                  setMenu(null);
                }}
              >
                <Icon name="download" size={11} />
                <span>Export…</span>
              </div>
              <div className="ctx-divider" />
              <div
                className="ctx-item danger"
                onClick={() => {
                  if (
                    confirm(
                      `Delete library “${src}” and all its icons from this app? Sets and groups for this import will be removed.`,
                    )
                  ) {
                    onDeleteLibrary(src);
                  }
                  setMenu(null);
                }}
              >
                <Icon name="trash" size={11} />
                <span>Delete library</span>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
