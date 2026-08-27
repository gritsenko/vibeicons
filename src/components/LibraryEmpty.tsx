import { Icon } from "./Icon";

interface Props {
  /** Whether public/preset.json offers anything — gates the catalog CTA. */
  hasCatalog: boolean;
  onOpenCatalog: () => void;
  onPickFile: () => void;
  onPickFolder: () => void;
  loading: boolean;
}

export function LibraryEmpty({
  hasCatalog,
  onOpenCatalog,
  onPickFile,
  onPickFolder,
  loading,
}: Props) {
  return (
    <div className="grid-wrap">
      <div className="empty-state empty-library">
        <Icon name="inbox" size={48} />
        <h3>Your library is empty</h3>
        <p>
          {hasCatalog ? (
            <>
              Import one or more of the bundled libraries — they live in this browser and stay
              available offline. You can also drop a JSON file in the sidebar, or use{" "}
              <strong>Import JSON</strong> / <strong>Import folder</strong> (SVG + optional .txt
              tags) in the top bar.
            </>
          ) : (
            <>
              Drop a JSON file with icon definitions in the sidebar, or use{" "}
              <strong>Import JSON</strong> / <strong>Import folder</strong> (SVG + optional .txt
              tags) in the top bar.
            </>
          )}
        </p>
        <div className="empty-actions">
          {hasCatalog && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={onOpenCatalog}
              disabled={loading}
            >
              <Icon name={loading ? "clock" : "layers"} size={13} />
              {loading ? "Importing…" : "Browse icon libraries"}
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
