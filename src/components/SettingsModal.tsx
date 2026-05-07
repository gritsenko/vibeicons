import type { GroupsMetaMap, SourcesMap } from "../types";
import { Icon } from "./Icon";

interface Props {
  iconCount: number;
  sources: SourcesMap;
  setsCount: number;
  groupsMeta: GroupsMetaMap;
  favoritesCount: number;
  onClose: () => void;
  onClearAll: () => void;
}

export function SettingsModal({
  iconCount,
  sources,
  setsCount,
  groupsMeta,
  favoritesCount,
  onClose,
  onClearAll,
}: Props) {
  const sourceList = Object.values(sources);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={14} />
          </button>
        </header>
        <div className="modal-body">
          <section className="settings-row">
            <div>
              <div className="settings-row-title">Library stats</div>
              <div className="settings-row-hint">
                {iconCount} icons · {Object.keys(sources).length} sources · {setsCount} sets ·{" "}
                {Object.keys(groupsMeta).length} groups · {favoritesCount} favorites
              </div>
            </div>
          </section>
          <section className="settings-row">
            <div>
              <div className="settings-row-title">Sources</div>
              <div className="settings-row-hint">Imported JSON files</div>
            </div>
            <div className="source-list">
              {sourceList.length === 0 ? (
                <div className="settings-row-hint">No imports yet</div>
              ) : (
                sourceList.map((s) => (
                  <div key={s.name} className="source-item">
                    <span>{s.name}</span>
                    <span className="settings-row-hint">{s.count}</span>
                  </div>
                ))
              )}
            </div>
          </section>
          <section className="settings-row danger">
            <div>
              <div className="settings-row-title">Reset everything</div>
              <div className="settings-row-hint">
                Removes all imported icons, sets, groups, sources, favorites and recents. Restores the
                default seed icons.
              </div>
            </div>
            <button
              className="btn btn-danger"
              onClick={() => {
                if (confirm("Delete all imported data? This cannot be undone.")) onClearAll();
              }}
            >
              <Icon name="trash" size={13} /> Clear all data
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
