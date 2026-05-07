import type { GroupsMetaMap, SetsMetaMap, GroupMeta, SetMeta } from "../types";
import { Icon } from "./Icon";

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
}: Props) {
  const setCount = new Map<string | number, number>(sets);

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

  function renderGroup(g: GroupMeta, depth: number): React.ReactNode {
    const expanded = expandedGroups[String(g.id)] === true;
    const subgroups = (childGroups.get(g.id) ?? [])
      .slice()
      .sort((a, b) => (a.label || "").localeCompare(b.label || ""));
    const groupSets = (childSets.get(g.id) ?? [])
      .slice()
      .sort((a, b) => (a.label || "").localeCompare(b.label || ""));
    const total = countTotal(g.id);
    if (total === 0 && subgroups.length === 0 && groupSets.length === 0) return null;

    // Collapse the synthetic per-source library wrapper when it just contains
    // a single child group with the same label (e.g. "Core Line" → "Core Line").
    if (
      String(g.id).endsWith(":__lib") &&
      groupSets.length === 0 &&
      subgroups.length === 1 &&
      (subgroups[0].label || "") === (g.label || "")
    ) {
      return renderGroup(subgroups[0], depth);
    }

    return (
      <div key={"g" + g.id}>
        <div
          className={"side-item tree-group" + (activeGroup === g.id ? " active" : "")}
          style={{ paddingLeft: 12 + depth * 12 }}
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
          <span className="tree-label" onClick={() => onPickGroup(g.id)} title={g.label}>
            {g.label}
          </span>
          <span className="side-count">{total}</span>
        </div>
        {expanded && (
          <div>
            {subgroups.map((sg) => renderGroup(sg, depth + 1))}
            {groupSets.map((s) => {
              const c = setCount.get(s.id) ?? 0;
              if (!c) return null;
              return (
                <div
                  key={"s" + s.id}
                  className={"side-item tree-set" + (activeSet === s.id ? " active" : "")}
                  style={{ paddingLeft: 12 + (depth + 1) * 12 + 14 }}
                  onClick={() => onPickSet(s.id)}
                  title={s.label}
                >
                  <Icon name="folder" size={12} />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.label}
                  </span>
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
      {rootSets.map((s) => (
        <div
          key={"rs" + s.id}
          className={"side-item tree-set" + (activeSet === s.id ? " active" : "")}
          style={{ paddingLeft: 26 }}
          onClick={() => onPickSet(s.id)}
          title={s.label}
        >
          <Icon name="folder" size={12} />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {s.label}
          </span>
          <span className="side-count">{setCount.get(s.id) ?? 0}</span>
        </div>
      ))}
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
    </div>
  );
}
