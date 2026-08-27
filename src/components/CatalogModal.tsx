import { useEffect } from "react";
import type { PresetSource } from "../lib/preset";
import type { SourcesMap } from "../types";
import { Icon } from "./Icon";
import { PresetCatalog } from "./PresetCatalog";

interface Props {
  /** Libraries listed by public/preset.json (already expanded from manifests). */
  entries: PresetSource[];
  /** Sources already in the library — rendered as "Imported" in the catalog. */
  imported: SourcesMap;
  /** Source names whose import is currently in flight. */
  busy: ReadonlySet<string>;
  /** Icons in the library right now — drives the footer's "N imported" hint. */
  iconCount: number;
  onImport: (entries: PresetSource[]) => void;
  onPickFile: () => void;
  onPickFolder: () => void;
  onClose: () => void;
}

/** The onboarding catalog. Lives in a modal rather than in the empty state so
 *  it survives the first import — the library stops being empty the moment one
 *  pack lands, and picking the next one shouldn't mean digging through
 *  Settings. */
export function CatalogModal({
  entries,
  imported,
  busy,
  iconCount,
  onImport,
  onPickFile,
  onPickFolder,
  onClose,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Add icons to your library</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={14} />
          </button>
        </header>
        <div className="modal-body catalog-modal-body">
          <p className="settings-row-hint">
            Pick as many libraries as you like — they are imported into this browser and stay
            available offline. This stays open while they load, so you can queue up the rest.
          </p>
          <PresetCatalog
            entries={entries}
            imported={imported}
            busy={busy}
            onImport={onImport}
          />
          <div className="catalog-modal-own">
            <div className="settings-row-hint">Have your own icons?</div>
            <div className="catalog-modal-own-actions">
              <button type="button" className="btn btn-sm" onClick={onPickFile}>
                <Icon name="upload" size={12} />
                Import a JSON file
              </button>
              <button type="button" className="btn btn-sm" onClick={onPickFolder}>
                <Icon name="folder" size={12} />
                Import SVG folder
              </button>
            </div>
          </div>
        </div>
        <footer className="modal-footer">
          <span className="settings-row-hint">
            {iconCount > 0 ? `${iconCount.toLocaleString("en-US")} icons in your library` : "Nothing imported yet"}
          </span>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            {iconCount > 0 ? "Done" : "Close"}
          </button>
        </footer>
      </div>
    </div>
  );
}
