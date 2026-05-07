import { Icon } from "./Icon";

interface Props {
  onLoadBundled: () => void;
  onPickFile: () => void;
  loading: boolean;
}

export function LibraryEmpty({ onLoadBundled, onPickFile, loading }: Props) {
  return (
    <div className="grid-wrap">
      <div className="empty-state empty-library">
        <Icon name="inbox" size={48} />
        <h3>Your library is empty</h3>
        <p>
          Drop a JSON file with icon definitions in the sidebar, click Import JSON in the topbar,
          or load the bundled <strong>Ant Design Icons</strong> library (~830 icons in three
          styles).
        </p>
        <div className="empty-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onLoadBundled}
            disabled={loading}
          >
            <Icon name={loading ? "clock" : "download"} size={13} />
            {loading ? "Loading…" : "Load Ant Design Icons"}
          </button>
          <button type="button" className="btn" onClick={onPickFile} disabled={loading}>
            <Icon name="upload" size={13} />
            Import a JSON file
          </button>
        </div>
        <p className="empty-credit">
          Bundled icons sourced from the open-source{" "}
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
