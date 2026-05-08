import type { IconRecord, Tweaks } from "../types";
import { Icon } from "./Icon";
import { RenderedIcon } from "./RenderedIcon";
import { highlightSvg, colorizeContent, downloadSVG, downloadPNG } from "../lib/svg";

const PRESET_COLORS = [
  "#F7F7F7",
  "#1A1D23",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

interface Props {
  selected: IconRecord;
  variations: IconRecord[];
  tweaks: Tweaks;
  color: string;
  setColor: (c: string) => void;
  setLabel: (id: string | number | null) => string;
  toggleFav: (key: string) => void;
  setQuery: (q: string) => void;
  selectVariation: (v: IconRecord) => void;
  copyText: (s: string, label?: string) => void;
}

export function DetailPanel({
  selected,
  variations,
  tweaks,
  color,
  setColor,
  setLabel,
  toggleFav,
  setQuery,
  selectVariation,
  copyText,
}: Props) {
  const selKey = (selected.source ?? "") + "::" + selected.name;
  const fgColor = tweaks.theme === "dark" ? "#e6e8ec" : "#1a1d23";

  return (
    <>
      <div className="detail-header">
        <div style={{ minWidth: 0 }}>
          <div className="detail-name">{selected.name}</div>
          <div className="detail-meta">
            {selected.source ? (
              <span className="detail-source-pill">{selected.source}</span>
            ) : null}
            {setLabel(selected.set_id)} · {selected.style} · {selected.width}×{selected.height}
          </div>
        </div>
        <div className="detail-actions">
          <button className="icon-btn" title="Toggle favorite" onClick={() => toggleFav(selKey)}>
            <Icon name="star" size={14} />
          </button>
        </div>
      </div>

      {variations.length > 0 && (
        <section className="preview-section">
          <div className="preview-label">
            <span>Variations</span>
            <span className="preview-label-meta">{variations.length + 1} libraries</span>
          </div>
          <div className="variations-row">
            {[selected, ...variations].map((v, vi) => {
              const isCurrent = v.source === selected.source;
              return (
                <button
                  key={(v.source ?? "") + vi}
                  className={"variation-cell" + (isCurrent ? " active" : "")}
                  onClick={() => {
                    if (isCurrent) return;
                    selectVariation(v);
                  }}
                  title={(v.source ?? "unknown") + " · " + v.name}
                >
                  <div className="variation-cell-icon">
                    <RenderedIcon icon={v} size={32} color={fgColor} />
                  </div>
                  <div className="variation-cell-label">{v.source ?? "—"}</div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <section className="preview-section">
        <div className="preview-label">Preview · dark / light</div>
        <div className="bg-pair">
          <div className="bg-card dark">
            <span className="bg-card-tag">dark</span>
            <RenderedIcon icon={selected} color={color} size={null} />
          </div>
          <div className="bg-card light">
            <span className="bg-card-tag">light</span>
            <RenderedIcon
              icon={selected}
              color={color === "#F7F7F7" ? "#1A1D23" : color}
              size={null}
            />
          </div>
        </div>
      </section>

      <section className="preview-section">
        <div className="preview-label">Sizes</div>
        <div className="size-row">
          {[16, 24, 32, 48, 64].map((s) => (
            <div key={s} className="size-cell">
              <div className="size-cell-icon" style={{ width: s, height: s }}>
                <RenderedIcon icon={selected} size={s} color={fgColor} />
              </div>
              <div className="size-cell-label">{s}px</div>
            </div>
          ))}
        </div>
      </section>

      <section className="preview-section">
        <div className="preview-label">Color</div>
        <div className="color-row">
          {PRESET_COLORS.map((c) => (
            <span
              key={c}
              className={"swatch" + (color.toLowerCase() === c.toLowerCase() ? " active" : "")}
              style={{ background: c }}
              onClick={() => setColor(c)}
              title={c}
            />
          ))}
          <div className="color-input-wrap">
            <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
            <input
              className="hex"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="preview-section">
        <div className="preview-label">Tags</div>
        <div className="tag-list">
          {String(selected.tags || "")
            .split(",")
            .filter(Boolean)
            .map((t) => (
              <span key={t} className="tag" onClick={() => setQuery(t.trim())}>
                {t.trim()}
              </span>
            ))}
        </div>
      </section>

      <section className="preview-section">
        <div className="preview-label">
          <span>SVG code</span>
          <button
            className="btn btn-ghost"
            style={{ height: 22, padding: "0 8px", fontSize: 11 }}
            onClick={() => copyText(colorizeContent(selected.content, color))}
          >
            <Icon name="copy" size={11} /> Copy
          </button>
        </div>
        <div
          className="code-box"
          dangerouslySetInnerHTML={{
            __html: highlightSvg(colorizeContent(selected.content, color)),
          }}
        />
      </section>

      <div className="detail-footer">
        <button className="btn" onClick={() => downloadSVG(selected.name, selected.content, color)}>
          <Icon name="download" size={13} /> SVG
        </button>
        <button
          className="btn"
          onClick={() => downloadPNG(selected.name, selected.content, color, 256)}
        >
          <Icon name="download" size={13} /> PNG
        </button>
      </div>
    </>
  );
}
