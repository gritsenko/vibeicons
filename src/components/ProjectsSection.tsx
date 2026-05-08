import { useEffect, useState } from "react";
import type { Project } from "../types";
import { Icon } from "./Icon";

interface Props {
  projects: Project[];
  activeProject: string | null;
  quickProjectId: string | null;
  dragKeys: string[];
  onSelectProject: (id: string) => void;
  onCreateProject: (name: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onDeleteProject: (id: string) => void;
  onSetQuick: (id: string | null) => void;
  onExportProject: (id: string) => void;
  onDropOnProject: (id: string, keys: string[]) => void;
}

export function ProjectsSection({
  projects,
  activeProject,
  quickProjectId,
  dragKeys,
  onSelectProject,
  onCreateProject,
  onRenameProject,
  onDeleteProject,
  onSetQuick,
  onExportProject,
  onDropOnProject,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  const commitCreate = () => {
    const name = draftName.trim();
    if (name) onCreateProject(name);
    setCreating(false);
    setDraftName("");
  };
  const commitRename = () => {
    if (renameId) {
      const v = renameValue.trim();
      if (v) onRenameProject(renameId, v);
    }
    setRenameId(null);
  };

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  return (
    <div className="side-section side-section-projects">
      <div className="side-label">
        <span>
          Projects {projects.length > 0 && <span className="count">{projects.length}</span>}
        </span>
        <button
          type="button"
          className="proj-add-btn"
          onClick={() => {
            setCreating(true);
            setDraftName("");
          }}
          title="New project"
        >
          <Icon name="plus" size={11} />
        </button>
      </div>

      {creating && (
        <div className="side-item proj-create-row">
          <Icon name="folder" size={14} />
          <input
            autoFocus
            className="proj-rename-input"
            value={draftName}
            placeholder="Project name…"
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitCreate}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitCreate();
              else if (e.key === "Escape") {
                setCreating(false);
                setDraftName("");
              }
            }}
          />
        </div>
      )}

      {projects.length === 0 && !creating && (
        <div className="proj-empty">No projects yet. Create one to collect icons.</div>
      )}

      {projects.map((p) => {
        const isActive = activeProject === p.id;
        const isQuick = quickProjectId === p.id;
        const isOver = dragOver === p.id;
        return (
          <div
            key={p.id}
            className={
              "side-item proj-item" +
              (isActive ? " active" : "") +
              (isOver ? " drag-over" : "") +
              (isQuick ? " is-quick" : "")
            }
            onClick={() => renameId !== p.id && onSelectProject(p.id)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenu({ x: e.clientX, y: e.clientY, id: p.id });
            }}
            onDragOver={(e) => {
              if (dragKeys.length) {
                e.preventDefault();
                setDragOver(p.id);
              }
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(null);
              if (dragKeys.length) onDropOnProject(p.id, dragKeys);
            }}
            title={p.name}
          >
            <Icon name="folder" size={14} />
            {renameId === p.id ? (
              <input
                autoFocus
                className="proj-rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitRename();
                  else if (e.key === "Escape") setRenameId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flex: 1,
                }}
              >
                {p.name}
              </span>
            )}
            {isQuick && (
              <span className="proj-quick-pill" title="Quick-add target">
                ●
              </span>
            )}
            <span className="side-count">{p.iconKeys.length}</span>
          </div>
        );
      })}

      {menu &&
        (() => {
          const p = projects.find((x) => x.id === menu.id);
          if (!p) return null;
          return (
            <div
              className="ctx-menu"
              style={{ left: menu.x, top: menu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ctx-header">{p.name}</div>
              <div className="ctx-divider" />
              <div
                className="ctx-item"
                onClick={() => {
                  onSelectProject(p.id);
                  setMenu(null);
                }}
              >
                <Icon name="folder" size={11} />
                <span>Open</span>
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  onSetQuick(quickProjectId === p.id ? null : p.id);
                  setMenu(null);
                }}
              >
                <Icon name="plus" size={11} />
                <span>
                  {quickProjectId === p.id ? "Unset quick-add target" : "Set as quick-add target"}
                </span>
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  setRenameId(p.id);
                  setRenameValue(p.name);
                  setMenu(null);
                }}
              >
                <Icon name="settings" size={11} />
                <span>Rename</span>
              </div>
              <div
                className="ctx-item"
                onClick={() => {
                  onExportProject(p.id);
                  setMenu(null);
                }}
              >
                <Icon name="download" size={11} />
                <span>Export…</span>
              </div>
              <div className="ctx-divider" />
              <div
                className="ctx-item danger"
                onClick={() => {
                  if (
                    confirm(
                      "Delete project “" + p.name + "”? Icons themselves are not removed.",
                    )
                  ) {
                    onDeleteProject(p.id);
                  }
                  setMenu(null);
                }}
              >
                <Icon name="trash" size={11} />
                <span>Delete project</span>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
