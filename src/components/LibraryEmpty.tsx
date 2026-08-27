import type { PresetSource } from "../lib/preset";
import type { SourcesMap } from "../types";
import { Icon } from "./Icon";
import { PresetCatalog } from "./PresetCatalog";

interface Props {
  /** Libraries listed by public/preset.json (already expanded from manifests). */
  presetSources: PresetSource[];
  /** Sources already in the library — rendered as "Imported" in the catalog. */
  importedSources: SourcesMap;
  /** Source names whose import is currently in flight. */
  presetBusy: ReadonlySet<string>;
  onImportPreset: (entries: PresetSource[]) => void;
  onPickFile: () => void;
  onPickFolder: () => void;
  loading: boolean;
}

export function LibraryEmpty({
  presetSources,
  importedSources,
  presetBusy,
  onImportPreset,
  onPickFile,
  onPickFolder,
  loading,
}: Props) {
  const hasPreset = presetSources.length > 0;
  return (
    <div className="grid-wrap">
      <div className="empty-state empty-library">
        <Icon name="inbox" size={48} />
        <h3>Your library is empty</h3>
        <p>
          {hasPreset ? (
            <>
              Pick one or more of the bundled libraries below — they are imported into this
              browser and stay available offline. You can also drop a JSON file in the sidebar,
              or use <strong>Import JSON</strong> / <strong>Import folder</strong> (SVG +
              optional .txt tags) in the top bar.
            </>
          ) : (
            <>
              Drop a JSON file with icon definitions in the sidebar, or use{" "}
              <strong>Import JSON</strong> / <strong>Import folder</strong> (SVG + optional .txt
              tags) in the top bar.
            </>
          )}
        </p>
        {hasPreset && (
          <div className="empty-catalog">
            <PresetCatalog
              entries={presetSources}
              imported={importedSources}
              busy={presetBusy}
              onImport={onImportPreset}
            />
          </div>
        )}
        <div className="empty-actions">
          <button type="button" className="btn" onClick={onPickFile} disabled={loading}>
            <Icon name="upload" size={13} />
            Import a JSON file
          </button>
          <button type="button" className="btn" onClick={onPickFolder} disabled={loading}>
            <Icon name="folder" size={13} />
            Import SVG folder
          </button>
        </div>
        <p className="empty-credit">
          The catalog is configured in <code>public/preset.json</code>; the bundled default is
          sourced from the open-source{" "}
          <a
            href="https://github.com/ant-design/ant-design-icons"
            target="_blank"
            rel="noopener noreferrer"
          >
            ant-design/ant-design-icons
          </a>{" "}
          (MIT).
        </p>
      </div>
    </div>
  );
}
