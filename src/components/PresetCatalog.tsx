import type { PresetSource } from "../lib/preset";
import type { SourcesMap } from "../types";
import { Icon } from "./Icon";

interface Props {
  /** Libraries listed by public/preset.json (manifests already expanded). */
  entries: PresetSource[];
  /** Sources already in the library — those rows render as "Imported". */
  imported: SourcesMap;
  /** Source names whose import is currently in flight. */
  busy: ReadonlySet<string>;
  onImport: (entries: PresetSource[]) => void;
}

function fmtCount(n: number): string {
  return n.toLocaleString("en-US");
}

function fmtSize(bytes: number): string {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

/** Groups the flat preset list by its `collection` label, keeping file order. */
function groupByCollection(entries: PresetSource[]): Array<[string, PresetSource[]]> {
  const out = new Map<string, PresetSource[]>();
  for (const e of entries) {
    const key = e.collection ?? "Libraries";
    const list = out.get(key);
    if (list) list.push(e);
    else out.set(key, [e]);
  }
  return [...out.entries()];
}

/** The preset catalog: every library public/preset.json knows about, with a
 *  per-library import button. Rendered both in the empty state (so a first-run
 *  visitor picks what to pull in) and in Settings. */
export function PresetCatalog({ entries, imported, busy, onImport }: Props) {
  if (entries.length === 0) {
    return (
      <div className="settings-row-hint">
        <code>public/preset.json</code> lists nothing loadable right now (missing file or
        unreachable URLs). Check the console for details.
      </div>
    );
  }
  const missing = entries.filter((e) => !imported[e.name]);
  const groups = groupByCollection(entries);
  const anyBusy = busy.size > 0;

  return (
    <div className="preset-catalog">
      <div className="preset-catalog-head">
        <span className="settings-row-hint">
          {entries.length - missing.length}/{entries.length} imported
        </span>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onImport(missing)}
          disabled={anyBusy || missing.length === 0}
        >
          <Icon name={anyBusy ? "clock" : "download"} size={13} />
          {anyBusy ? "Importing…" : missing.length === 0 ? "All imported" : "Import all"}
        </button>
      </div>
      {groups.map(([collection, list]) => (
        <div key={collection} className="preset-group">
          <div className="preset-group-title">{collection}</div>
          {list.map((entry) => {
            const isImported = Boolean(imported[entry.name]);
            const isBusy = busy.has(entry.name);
            return (
              <div key={entry.name} className="preset-item">
                <div className="preset-item-main">
                  <span className="preset-item-name">{entry.name}</span>
                  <span className="preset-item-meta">
                    {entry.count != null ? `${fmtCount(entry.count)} icons` : "library"}
                    {entry.bytes != null ? ` · ${fmtSize(entry.bytes)}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  className={"btn btn-sm" + (isImported ? " btn-ghost" : "")}
                  onClick={() => onImport([entry])}
                  disabled={isImported || isBusy || anyBusy}
                >
                  <Icon
                    name={isImported ? "check" : isBusy ? "clock" : "download"}
                    size={12}
                  />
                  {isImported ? "Imported" : isBusy ? "Importing…" : "Import"}
                </button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
