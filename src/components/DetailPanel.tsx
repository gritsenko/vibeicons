import { useEffect, useMemo, useRef, useState } from "react";
import type { IconRecord, PreviewBg, Tweaks } from "../types";
import { Icon } from "./Icon";
import { RenderedIcon } from "./RenderedIcon";
import {
  highlightSvg,
  colorizeContent,
  downloadSVG,
  downloadPNG,
  rasterizeSvgToPngBlob,
} from "../lib/svg";

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

const PNG_EXPORT_PRESETS = [16, 24, 32, 48, 64, 128, 256] as const;

const DETAIL_PNG_PREVIEW_BOX = 72;

const PREVIEW_BGS: { value: PreviewBg; title: string }[] = [
  { value: "checker", title: "Checker on light (transparency)" },
  { value: "checker-dark", title: "Checker on dark (transparency)" },
  { value: "dark", title: "Solid dark background" },
  { value: "light", title: "Solid light background" },
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

  const [pngExportSize, setPngExportSize] = useState(256);
  const [pngExportPadding, setPngExportPadding] = useState(0);
  const [pngPreviewBg, setPngPreviewBg] = useState<PreviewBg>("checker");

  const maxPngPadding = useMemo(
    () => Math.max(0, Math.floor(pngExportSize / 2) - 1),
    [pngExportSize],
  );
  const safePngPadding = Math.min(pngExportPadding, maxPngPadding);

  const [pngPreviewUrl, setPngPreviewUrl] = useState<string | null>(null);
  const pngPreviewUrlRef = useRef<string | null>(null);
  const pngPreviewKey =
    selected.key + ":" + pngExportSize + ":" + safePngPadding + ":" + color;

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const blob = await rasterizeSvgToPngBlob(
          colorizeContent(selected.content, color),
          pngExportSize,
          safePngPadding,
        );
        if (cancelled) return;
        if (!blob) {
          setPngPreviewUrl(null);
          return;
        }
        const url = URL.createObjectURL(blob);
        const prev = pngPreviewUrlRef.current;
        pngPreviewUrlRef.current = url;
        setPngPreviewUrl(url);
        if (prev) URL.revokeObjectURL(prev);
      } catch {
        if (!cancelled) setPngPreviewUrl(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [pngPreviewKey, selected.content, color, pngExportSize, safePngPadding]);

  useEffect(() => {
    return () => {
      if (pngPreviewUrlRef.current) URL.revokeObjectURL(pngPreviewUrlRef.current);
    };
  }, []);

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

      <div className="detail-footer-stack">
        <div className="detail-export-settings">
          <div className="detail-export-settings-head">
            <span className="detail-export-settings-label">PNG export</span>
          </div>
          <div className="detail-export-settings-body">
            <div className="detail-export-controls">
              <div className="detail-export-size-group">
                <label className="detail-export-field">
                  <span className="detail-export-field-cap">Size</span>
                  <input
                    type="number"
                    className="detail-export-num"
                    min={8}
                    max={2048}
                    step={1}
                    value={pngExportSize}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v))
                        setPngExportSize(Math.max(8, Math.min(2048, v)));
                    }}
                  />
                </label>
                <div className="detail-export-presets">
                  {PNG_EXPORT_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={
                        "detail-export-preset" + (pngExportSize === s ? " active" : "")
                      }
                      onClick={() => setPngExportSize(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <label className="detail-export-field detail-export-field-pad-block">
                <span className="detail-export-field-cap">
                  Padding{" "}
                  <span className="detail-export-field-meta">max {maxPngPadding}</span>
                </span>
                <div className="detail-export-pad-inputs png-field-input">
                  <input
                    type="number"
                    className="detail-export-num"
                    min={0}
                    max={maxPngPadding}
                    step={1}
                    value={safePngPadding}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!Number.isNaN(v))
                        setPngExportPadding(Math.max(0, Math.min(maxPngPadding, v)));
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={maxPngPadding}
                    step={1}
                    value={safePngPadding}
                    disabled={maxPngPadding === 0}
                    aria-label="PNG padding"
                    onChange={(e) =>
                      setPngExportPadding(
                        Math.max(0, Math.min(maxPngPadding, parseInt(e.target.value, 10))),
                      )
                    }
                  />
                </div>
              </label>
            </div>
            <div className="png-preview-wrap detail-export-png-preview-wrap">
              <div className="png-preview-label">Preview</div>
              <div
                className={"png-preview png-preview-" + pngPreviewBg}
                style={{ width: DETAIL_PNG_PREVIEW_BOX, height: DETAIL_PNG_PREVIEW_BOX }}
                title={`${pngExportSize}×${pngExportSize}px`}
              >
                {pngPreviewUrl ? (
                  <img
                    src={pngPreviewUrl}
                    alt={selected.name}
                    draggable={false}
                  />
                ) : (
                  <RenderedIcon icon={selected} size={null} color={color} />
                )}
              </div>
              <div className="png-preview-bg-toggle" role="group" aria-label="Preview background">
                {PREVIEW_BGS.map((bg) => (
                  <button
                    key={bg.value}
                    type="button"
                    className={
                      "png-preview-bg-btn png-preview-bg-btn-" +
                      bg.value +
                      (pngPreviewBg === bg.value ? " active" : "")
                    }
                    onClick={() => setPngPreviewBg(bg.value)}
                    title={bg.title}
                    aria-label={bg.title}
                  />
                ))}
              </div>
              <div className="png-preview-meta">
                {pngExportSize}×{pngExportSize}
                {safePngPadding > 0 ? ` · pad ${safePngPadding}` : ""}
              </div>
            </div>
          </div>
        </div>

        <div className="detail-footer">
          <button
            className="btn"
            onClick={() => downloadSVG(selected.name, selected.content, color)}
          >
            <Icon name="download" size={13} /> SVG
          </button>
          <button
            className="btn"
            onClick={() =>
              downloadPNG(
                selected.name,
                selected.content,
                color,
                pngExportSize,
                safePngPadding,
              )
            }
          >
            <Icon name="download" size={13} /> PNG
          </button>
        </div>
      </div>
    </>
  );
}
