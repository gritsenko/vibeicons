import type { PresetSource } from "../lib/preset";
import type { GroupsMetaMap, SourcesMap } from "../types";
import { Icon } from "./Icon";
import { PresetCatalog } from "./PresetCatalog";

interface Props {
  iconCount: number;
  sources: SourcesMap;
  setsCount: number;
  groupsMeta: GroupsMetaMap;
  favoritesCount: number;
  /** Libraries listed by public/preset.json (already expanded from manifests). */
  presetSources: PresetSource[];
  /** Source names whose import is currently in flight. */
  presetBusy: ReadonlySet<string>;
  resetting: boolean;
  onClose: () => void;
  onClearAll: () => void;
  onImportPreset: (entries: PresetSource[]) => void;
  onFullReset: () => void;
}

export function SettingsModal({
  iconCount,
  sources,
  setsCount,
  groupsMeta,
  favoritesCount,
  presetSources,
  presetBusy,
  resetting,
  onClose,
  onClearAll,
  onImportPreset,
  onFullReset,
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
          <section className="settings-row settings-row-stack">
            <div>
              <div className="settings-row-title">Icon catalog</div>
              <div className="settings-row-hint">
                Libraries bundled with the app, configured in <code>public/preset.json</code>.
                Import what you need — already-imported sources are skipped, so this is safe to
                use any time.
              </div>
            </div>
            <PresetCatalog
              entries={presetSources}
              imported={sources}
              busy={presetBusy}
              onImport={onImportPreset}
            />
          </section>
          <section className="settings-row danger">
            <div>
              <div className="settings-row-title">Clear library</div>
              <div className="settings-row-hint">
                Removes all imported icons, sets, groups, sources, favorites, collections and
                recents. The library is left empty and stays empty on reload — import again from
                the catalog above if you want it back.
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
                flag, then reloads the app — it comes back up exactly like a fresh install,
                showing the icon catalog on an empty library.
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
