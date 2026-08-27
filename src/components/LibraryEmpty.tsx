import { Icon } from "./Icon";

interface Props {
  /** Source names listed by public/preset.json (already expanded from manifests). */
  presetSourceNames: string[];
  onLoadPreset: () => void;
  onPickFile: () => void;
  onPickFolder: () => void;
  loading: boolean;
}

export function LibraryEmpty({
  presetSourceNames,
  onLoadPreset,
  onPickFile,
  onPickFolder,
  loading,
}: Props) {
  const hasPreset = presetSourceNames.length > 0;
  return (
    <div className="grid-wrap">
      <div className="empty-state empty-library">
        <Icon name="inbox" size={48} />
        <h3>Your library is empty</h3>
        <p>
          Drop a JSON file with icon definitions in the sidebar, use <strong>Import JSON</strong>{" "}
          or <strong>Import folder</strong> (SVG + optional .txt tags) in the top bar
          {hasPreset ? (
            <>
              , or load the preset library ({presetSourceNames.join(", ")}).
            </>
          ) : (
            <>.</>
          )}
        </p>
        <div className="empty-actions">
          {hasPreset && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onLoadPreset}
              disabled={loading}
            >
              <Icon name={loading ? "clock" : "download"} size={13} />
              {loading ? "Loading…" : "Load preset icons"}
            </button>
          )}
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
          Preset libraries are configured in <code>public/preset.json</code>; the bundled default
          is sourced from the open-source{" "}
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
