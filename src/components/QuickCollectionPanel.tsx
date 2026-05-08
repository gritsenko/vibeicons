import { useEffect, useMemo, useState } from "react";
import type { IconRecord, Project, Tweaks } from "../types";
import { Icon } from "./Icon";
import { RenderedIcon } from "./RenderedIcon";

/** Stable fallback so hooks don’t see a new `{}` every render (that was resetting the rename field). */
const EMPTY_ICON_ALIASES: Record<string, string> = Object.freeze({});

interface Props {
  project: Project | null;
  icons: IconRecord[];
  projects: Project[];
  theme: Tweaks["theme"];
  onSetIconAlias: (iconKey: string, displayName: string) => void;
  onRemove: (key: string) => void;
  onClear: (id: string) => void;
  onExport: (id: string) => void;
  onSetQuick: (id: string | null) => void;
  onOpenProject: (id: string) => void;
}

export function QuickCollectionPanel({
  project,
  icons,
  projects,
  theme,
  onSetIconAlias,
  onRemove,
  onClear,
  onExport,
  onSetQuick,
  onOpenProject,
}: Props) {
  const fg = theme === "dark" ? "#e6e8ec" : "#1a1d23";

  const aliases = project?.iconAliases ?? EMPTY_ICON_ALIASES;
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  const selectedIcon = useMemo(
    () => icons.find((i) => i.key === selectedKey) ?? null,
    [icons, selectedKey],
  );

  useEffect(() => {
    setSelectedKey(null);
    setRenameDraft("");
  }, [project?.id]);

  useEffect(() => {
    if (!selectedKey || !icons.some((i) => i.key === selectedKey)) {
      setSelectedKey(null);
      setRenameDraft("");
    }
  }, [icons, selectedKey]);

  useEffect(() => {
    if (!selectedIcon) {
      setRenameDraft("");
      return;
    }
    const label = aliases[selectedIcon.key] ?? selectedIcon.name;
    setRenameDraft(label);
  }, [selectedIcon, aliases]);

  const commitRename = () => {
    if (!selectedIcon) return;
    onSetIconAlias(selectedIcon.key, renameDraft);
  };

  if (!project) {
    if (projects.length === 0) {
      return (
        <div className="quick-panel quick-panel-empty">
          <div className="quick-panel-head-static">
            <Icon name="layers" size={12} />
            <span>Quick collection</span>
          </div>
          <div className="quick-panel-hint">
            Create a project in the sidebar to start collecting icons by double-click.
          </div>
        </div>
      );
    }
    return (
      <div className="quick-panel quick-panel-empty">
        <div className="quick-panel-head-static">
          <Icon name="layers" size={12} />
          <span>Quick collection</span>
        </div>
        <div className="quick-panel-hint">Pick a project to quick-add to by double-click:</div>
        <select
          className="quick-panel-select"
          onChange={(e) => onSetQuick(e.target.value || null)}
          value=""
        >
          <option value="">Choose project…</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} · {p.iconKeys.length}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="quick-panel">
      <div className="quick-panel-head">
        <button
          type="button"
          className="quick-panel-title"
          onClick={() => onOpenProject(project.id)}
          title="Open project view"
        >
          <Icon name="folder" size={12} />
          <span>{project.name}</span>
          <span className="quick-panel-count">{project.iconKeys.length}</span>
        </button>
        <div className="quick-panel-head-actions">
          <button
            type="button"
            className="icon-btn"
            title="Export project"
            onClick={() => onExport(project.id)}
          >
            <Icon name="download" size={12} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Switch quick-add target"
            onClick={() => onSetQuick(null)}
          >
            <Icon name="x" size={12} />
          </button>
        </div>
      </div>
      {icons.length > 0 && (
        <label className="quick-panel-rename">
          <span className="quick-panel-rename-label">Name in collection</span>
          <input
            type="text"
            className="quick-panel-rename-input"
            value={renameDraft}
            disabled={!selectedIcon}
            placeholder={selectedIcon ? undefined : "Select an icon below"}
            onChange={(e) => setRenameDraft(e.target.value)}
            onBlur={() => commitRename()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
          />
        </label>
      )}
      {icons.length === 0 ? (
        <div className="quick-panel-hint quick-panel-drop">
          Double-click any icon to add it here.
        </div>
      ) : (
        <div className="quick-panel-grid">
          {icons.map((ic) => {
            const displayName = aliases[ic.key] ?? ic.name;
            const isSel = selectedKey === ic.key;
            return (
              <div
                key={ic.key}
                role="button"
                tabIndex={0}
                className={"quick-cell" + (isSel ? " selected" : "")}
                title={displayName + (ic.source ? " · " + ic.source : "")}
                onClick={() => setSelectedKey(ic.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedKey(ic.key);
                  }
                }}
                >
                  <div className="quick-cell-icon-wrap">
                    <RenderedIcon icon={ic} size={null} color={fg} />
                  </div>
                  <button
                    type="button"
                    className="quick-cell-x"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedKey === ic.key) {
                        setSelectedKey(null);
                        setRenameDraft("");
                      }
                      onRemove(ic.key);
                    }}
                    title="Remove"
                  >
                    ×
                  </button>
                </div>
            );
          })}
        </div>
      )}
      <div className="quick-panel-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => onClear(project.id)}
          disabled={icons.length === 0}
        >
          Clear
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => onExport(project.id)}
          disabled={icons.length === 0}
        >
          <Icon name="download" size={11} /> Export
        </button>
      </div>
    </div>
  );
}
