import type { GroupsMetaMap, SourcesMap } from "../types";
import { Icon } from "./Icon";

interface Props {
  iconCount: number;
  sources: SourcesMap;
  setsCount: number;
  groupsMeta: GroupsMetaMap;
  favoritesCount: number;
  /** Source names listed by public/preset.json (already expanded from manifests). */
  presetSourceNames: string[];
  presetLoading: boolean;
  resetting: boolean;
  onClose: () => void;
  onClearAll: () => void;
  onLoadPreset: () => void;
  onFullReset: () => void;
}

export function SettingsModal({
  iconCount,
  sources,
  setsCount,
  groupsMeta,
  favoritesCount,
  presetSourceNames,
  presetLoading,
  resetting,
  onClose,
  onClearAll,
  onLoadPreset,
  onFullReset,
}: Props) {
  const presetTotal = presetSourceNames.length;
  const presetLoadedCount = presetSourceNames.filter((n) => sources[n]).length;
  const allPresetLoaded = presetTotal > 0 && presetLoadedCount === presetTotal;
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
              <div className="settings-row-title">Preset library</div>
              <div className="settings-row-hint">
                {presetTotal === 0 ? (
                  <>
                    <code>public/preset.json</code> lists nothing loadable right now (missing file
                    or unreachable URLs). Check the console for details.
                  </>
                ) : (
                  <>
                    Imported automatically on a first run and re-loadable here. Configured in{" "}
                    <code>public/preset.json</code>: {presetSourceNames.join(", ")}. Already-loaded
                    sources are skipped, so this is safe to click any time.{" "}
                    <strong>
                      {presetLoadedCount}/{presetTotal}
                    </strong>{" "}
                    loaded.
                  </>
                )}
              </div>
            </div>
            <button
              className="btn btn-primary"
              onClick={onLoadPreset}
              disabled={presetLoading || allPresetLoaded || presetTotal === 0}
            >
              <Icon name={presetLoading ? "clock" : "download"} size={13} />
              {presetLoading
                ? "Loading…"
                : allPresetLoaded
                  ? "All loaded"
                  : presetLoadedCount > 0
                    ? "Load missing"
                    : "Load preset"}
            </button>
          </section>
          <section className="settings-row danger">
            <div>
              <div className="settings-row-title">Clear library</div>
              <div className="settings-row-hint">
                Removes all imported icons, sets, groups, sources, favorites, collections and
                recents. The library is left empty and stays empty on reload — load the preset
                again from the section above if you want it back.
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
          <section className="settings-row danger">
            <div>
              <div className="settings-row-title">Full reset</div>
              <div className="settings-row-hint">
                Wipes IndexedDB and every local setting, including the “preset already applied”
                flag, then reloads the app — it comes back up exactly like a fresh install and
                re-imports the preset library.
              </div>
            </div>
            <button
              className="btn btn-danger"
              disabled={resetting}
              onClick={() => {
                if (
                  confirm(
                    "Full reset: delete all local data and reload as a fresh install? This cannot be undone.",
                  )
                )
                  onFullReset();
              }}
            >
              <Icon name={resetting ? "clock" : "refresh"} size={13} />
              {resetting ? "Resetting…" : "Reset & reload"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
