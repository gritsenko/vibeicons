import { memo, useMemo } from "react";
import type { IconRecord, SetsMetaMap } from "../types";
import { Icon } from "./Icon";
import { RenderedIcon } from "./RenderedIcon";

interface Props {
  items: IconRecord[];
  setsMeta: SetsMetaMap;
  selectedKey: string | null;
  selectedKeys: Set<string>;
  favoriteKeys: Set<string>;
  projectKeys?: Set<string>;
  showLabels: boolean;
  fgColor: string;
  tileMin: number;
  onSelect: (key: string, e: React.MouseEvent) => void;
  onActivate: (key: string) => void;
  onContext: (key: string, x: number, y: number) => void;
  onDragStart: (key: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
  onPickSet: (id: string | number) => void;
}

const NO_SET_KEY = "__none__";

interface Section {
  key: string;
  setId: string | number | null;
  label: string;
  items: IconRecord[];
}

export function GroupedIconGrid({
  items,
  setsMeta,
  selectedKey,
  selectedKeys,
  favoriteKeys,
  projectKeys,
  showLabels,
  fgColor,
  tileMin,
  onSelect,
  onActivate,
  onContext,
  onDragStart,
  onDragEnd,
  onPickSet,
}: Props) {
  const sections = useMemo<Section[]>(() => {
    const map = new Map<string, Section>();
    for (const ic of items) {
      const sid = ic.set_id ?? null;
      const key = sid == null ? NO_SET_KEY : String(sid);
      let sec = map.get(key);
      if (!sec) {
        const label =
          sid == null
            ? "Ungrouped"
            : (setsMeta[String(sid)]?.label ?? "Set " + sid);
        sec = { key, setId: sid, label, items: [] };
        map.set(key, sec);
      }
      sec.items.push(ic);
    }
    const list = [...map.values()];
    list.sort((a, b) => a.label.localeCompare(b.label));
    for (const sec of list) {
      sec.items.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [items, setsMeta]);

  if (items.length === 0) {
    return (
      <div className="grid-wrap">
        <div className="empty-state">
          <Icon name="inbox" size={40} />
          <h3>No icons match</h3>
          <p>
            Try a different search or filter, or import a JSON file with icon
            definitions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grouped-scroll">
      {sections.map((sec) => (
        <section key={sec.key} className="grouped-section">
          <header className="grouped-section-head">
            <button
              type="button"
              className="grouped-section-title"
              onClick={() => sec.setId != null && onPickSet(sec.setId)}
              disabled={sec.setId == null}
              title={
                sec.setId != null
                  ? `Open set: ${sec.label}`
                  : "Icons without a set"
              }
            >
              <Icon name="folder" size={13} />
              <span className="grouped-section-name">{sec.label}</span>
            </button>
            <span className="grouped-section-count">
              {sec.items.length.toLocaleString()}
            </span>
          </header>
          <div
            className="grouped-section-grid"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${tileMin}px, 1fr))`,
            }}
          >
            {sec.items.map((ic) => (
              <GroupedTile
                key={ic.key}
                icon={ic}
                isSelected={selectedKey === ic.key}
                isMulti={selectedKeys.has(ic.key)}
                isFav={favoriteKeys.has(ic.key)}
                inProject={projectKeys ? projectKeys.has(ic.key) : false}
                showLabel={showLabels}
                fgColor={fgColor}
                onSelect={onSelect}
                onActivate={onActivate}
                onContext={onContext}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

interface TileProps {
  icon: IconRecord;
  isSelected: boolean;
  isMulti: boolean;
  isFav: boolean;
  inProject: boolean;
  showLabel: boolean;
  fgColor: string;
  onSelect: (key: string, e: React.MouseEvent) => void;
  onActivate: (key: string) => void;
  onContext: (key: string, x: number, y: number) => void;
  onDragStart: (key: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
}

const GroupedTile = memo(function GroupedTile({
  icon,
  isSelected,
  isMulti,
  isFav,
  inProject,
  showLabel,
  fgColor,
  onSelect,
  onActivate,
  onContext,
  onDragStart,
  onDragEnd,
}: TileProps) {
  return (
    <div
      className={
        "tile" +
        (isSelected ? " selected" : "") +
        (isMulti ? " multi-selected" : "") +
        (isFav ? " is-fav" : "") +
        (inProject ? " in-project" : "") +
        (showLabel ? " show-label" : "")
      }
      draggable
      onClick={(e) => onSelect(icon.key, e)}
      onDoubleClick={(e) => {
        e.preventDefault();
        onActivate(icon.key);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContext(icon.key, e.clientX, e.clientY);
      }}
      onDragStart={(e) => onDragStart(icon.key, e)}
      onDragEnd={onDragEnd}
      title={
        icon.name +
        (icon.source ? " · " + icon.source : "") +
        (inProject ? " · already in project" : "")
      }
    >
      <RenderedIcon icon={icon} size={null} color={fgColor} />
      <span className="tile-fav">
        <Icon name="star" size={11} />
      </span>
      {inProject && (
        <span className="tile-in-proj" aria-label="In current project">
          <Icon name="check" size={10} />
        </span>
      )}
      <span className="tile-label">{icon.name}</span>
      {icon.source && <span className="tile-source">{icon.source}</span>}
      {isMulti && <span className="tile-multi-mark">✓</span>}
    </div>
  );
});
