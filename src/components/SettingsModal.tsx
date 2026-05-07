import type { GroupsMetaMap, SourcesMap } from "../types";
import { Icon } from "./Icon";

const ANT_SOURCE_NAMES = [
  "Ant Design Outlined",
  "Ant Design Filled",
  "Ant Design TwoTone",
];

interface Props {
  iconCount: number;
  sources: SourcesMap;
  setsCount: number;
  groupsMeta: GroupsMetaMap;
  favoritesCount: number;
  bundledLoading: boolean;
  onClose: () => void;
  onClearAll: () => void;
  onLoadBundled: () => void;
}

export function SettingsModal({
  iconCount,
  sources,
  setsCount,
  groupsMeta,
  favoritesCount,
  bundledLoading,
  onClose,
  onClearAll,
  onLoadBundled,
}: Props) {
  const antLoadedCount = ANT_SOURCE_NAMES.filter((n) => sources[n]).length;
  const allAntLoaded = antLoadedCount === ANT_SOURCE_NAMES.length;
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
          <section className="settings-row">
            <div>
              <div className="settings-row-title">Bundled icon library</div>
              <div className="settings-row-hint">
                Loads Ant Design Icons (~830 icons across outlined / filled / twotone) into your
                library. Already-loaded styles are skipped, so this is safe to click any time.
                {antLoadedCount > 0 && (
                  <>
                    {" "}
                    <strong>
                      {antLoadedCount}/{ANT_SOURCE_NAMES.length}
                    </strong>{" "}
                    style{antLoadedCount === 1 ? "" : "s"} loaded.
                  </>
                )}
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={onLoadBundled}
              disabled={bundledLoading || allAntLoaded}
            >
              <Icon name={bundledLoading ? "clock" : "download"} size={13} />
              {bundledLoading
                ? "Loading…"
                : allAntLoaded
                  ? "All loaded"
                  : antLoadedCount > 0
                    ? "Load missing"
                    : "Load Ant Design"}
            </button>
          </section>
          <section className="settings-row danger">
            <div>
              <div className="settings-row-title">Reset everything</div>
              <div className="settings-row-hint">
                Removes all imported icons, sets, groups, sources, favorites and recents. The
                library is left empty — load Ant Design again from the section above if you want
                it back.
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
