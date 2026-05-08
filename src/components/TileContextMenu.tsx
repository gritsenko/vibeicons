import { useEffect, useState } from "react";
import type { Project } from "../types";
import { Icon } from "./Icon";

interface Props {
  x: number;
  y: number;
  count: number;
  projects: Project[];
  quickProjectId: string | null;
  isInProject: boolean;
  onAddTo: (projectId: string) => void;
  onCreateAndAdd: (name: string) => void;
  onRemoveFrom: () => void;
  onSetQuick: (id: string | null) => void;
  onClose: () => void;
}

export function TileContextMenu({
  x,
  y,
  count,
  projects,
  quickProjectId,
  isInProject,
  onAddTo,
  onCreateAndAdd,
  onRemoveFrom,
  onSetQuick,
  onClose,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [onClose]);

  const W = 240;
  const H = Math.min(60 + 32 * (projects.length + 2), 360);
  const left = Math.min(x, window.innerWidth - W - 8);
  const top = Math.min(y, window.innerHeight - H - 8);

  return (
    <div
      className="ctx-menu"
      style={{ left, top, width: W }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="ctx-header">{count > 1 ? count + " icons selected" : "1 icon"}</div>
      <div className="ctx-divider" />
      <div className="ctx-section">Add to project</div>
      {projects.length === 0 && !creating && (
        <div className="ctx-empty">No projects yet</div>
      )}
      {projects.map((p) => (
        <div
          key={p.id}
          className="ctx-item"
          onClick={() => {
            onAddTo(p.id);
            onClose();
          }}
        >
          <Icon name="folder" size={11} />
          <span
            style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {p.name}
          </span>
          <span className="ctx-count">{p.iconKeys.length}</span>
        </div>
      ))}
      {creating ? (
        <div className="ctx-item ctx-input-row">
          <Icon name="plus" size={11} />
          <input
            autoFocus
            value={name}
            placeholder="New project name"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (name.trim()) {
                  onCreateAndAdd(name.trim());
                  onClose();
                }
              } else if (e.key === "Escape") {
                setCreating(false);
                setName("");
              }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : (
        <div
          className="ctx-item"
          onClick={(e) => {
            e.stopPropagation();
            setCreating(true);
          }}
        >
          <Icon name="plus" size={11} />
          <span>New project…</span>
        </div>
      )}
      {projects.length > 0 && (
        <>
          <div className="ctx-divider" />
          <div className="ctx-section">Quick-add target</div>
          {projects.map((p) => (
            <div
              key={"q" + p.id}
              className={"ctx-item" + (quickProjectId === p.id ? " active" : "")}
              onClick={() => {
                onSetQuick(quickProjectId === p.id ? null : p.id);
                onClose();
              }}
            >
              <span className="ctx-radio">{quickProjectId === p.id ? "●" : "○"}</span>
              <span>{p.name}</span>
            </div>
          ))}
        </>
      )}
      {isInProject && (
        <>
          <div className="ctx-divider" />
          <div
            className="ctx-item danger"
            onClick={() => {
              onRemoveFrom();
              onClose();
            }}
          >
            <Icon name="trash" size={11} />
            <span>Remove from this project</span>
          </div>
        </>
      )}
    </div>
  );
}
