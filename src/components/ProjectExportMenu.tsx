import { useEffect, useRef, useState } from "react";
import JSZip from "jszip";
import type {
  IconRecord,
  PreviewBg,
  Project,
  ProjectExportSettings,
} from "../types";
import { Icon } from "./Icon";
import { RenderedIcon } from "./RenderedIcon";
import { colorizeContent } from "../lib/svg";

interface Props {
  project: Project;
  icons: IconRecord[];
  settings?: ProjectExportSettings;
  onSettingsChange: (patch: Partial<ProjectExportSettings>) => void;
  showToast: (msg: string) => void;
  onClose: () => void;
}

const PNG_SIZE_PRESETS = [16, 24, 32, 48, 64, 128, 256, 512];
const PREVIEW_BOX = 96;

const PRESET_COLORS = [
  "#1A1D23",
  "#F7F7F7",
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
];

const DEFAULT_SETTINGS: ProjectExportSettings = {
  color: "#1A1D23",
  pngSize: 256,
  pngPadding: 0,
  previewBg: "checker",
};

const PREVIEW_BGS: { value: PreviewBg; label: string; title: string }[] = [
  { value: "checker", label: "Transparent", title: "Checker on light (transparency)" },
  { value: "checker-dark", label: "Transparent dark", title: "Checker on dark (transparency)" },
  { value: "dark", label: "Dark", title: "Solid dark background" },
  { value: "light", label: "Light", title: "Solid light background" },
];

function uniqueName(used: Map<string, number>, base: string, ext: string): string {
  const safe = base.replace(/[\\/:*?"<>|]+/g, "_");
  const initial = safe + ext;
  if (!used.has(initial)) {
    used.set(initial, 1);
    return initial;
  }
  const c = (used.get(initial) ?? 1) + 1;
  used.set(initial, c);
  return safe + "-" + c + ext;
}

function downloadBlob(name: string, blob: Blob): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function rasterizeToBlob(
  svg: string,
  size: number,
  padding: number,
): Promise<Blob | null> {
  return new Promise((res, rej) => {
    const inner = Math.max(1, size - 2 * padding);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = size;
      c.height = size;
      const ctx = c.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        res(null);
        return;
      }
      ctx.clearRect(0, 0, size, size);
      ctx.drawImage(img, padding, padding, inner, inner);
      c.toBlob((b) => {
        URL.revokeObjectURL(url);
        res(b);
      });
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      rej(e);
    };
    img.src = url;
  });
}

export function ProjectExportMenu({
  project,
  icons,
  settings,
  onSettingsChange,
  showToast,
  onClose,
}: Props) {
  const merged: ProjectExportSettings = {
    ...DEFAULT_SETTINGS,
    ...(settings ?? {}),
  };
  const { color, pngSize, pngPadding, previewBg } = merged;

  const setColor = (v: string) => onSettingsChange({ color: v });
  const setPngSize = (v: number) =>
    onSettingsChange({ pngSize: Math.max(8, Math.min(2048, v)) });
  const setPngPadding = (v: number) =>
    onSettingsChange({ pngPadding: Math.max(0, v) });
  const setPreviewBg = (v: PreviewBg) => onSettingsChange({ previewBg: v });

  const [busy, setBusy] = useState(false);

  // Clamp padding so it never exceeds half the size — beyond that the icon
  // would have zero or negative area.
  const maxPadding = Math.max(0, Math.floor(pngSize / 2) - 1);
  const safePadding = Math.min(pngPadding, maxPadding);

  // Live PNG preview — rasterize the first icon to the requested size+padding,
  // then display the resulting bitmap (scaled by CSS to PREVIEW_BOX) so users see
  // the *actual* pixel result, including padding and any aliasing.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewIcon = icons[0] ?? null;
  const previewKey = previewIcon
    ? previewIcon.key + ":" + pngSize + ":" + safePadding + ":" + color
    : null;
  const lastUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!previewIcon) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      try {
        const blob = await rasterizeToBlob(
          colorizeContent(previewIcon.content, color),
          pngSize,
          safePadding,
        );
        if (cancelled) return;
        if (!blob) {
          setPreviewUrl(null);
          return;
        }
        const url = URL.createObjectURL(blob);
        const prev = lastUrlRef.current;
        lastUrlRef.current = url;
        setPreviewUrl(url);
        if (prev) URL.revokeObjectURL(prev);
      } catch {
        if (!cancelled) setPreviewUrl(null);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [previewKey, previewIcon, color, pngSize, safePadding]);

  useEffect(() => {
    return () => {
      if (lastUrlRef.current) URL.revokeObjectURL(lastUrlRef.current);
    };
  }, []);

  const exportJSON = () => {
    const data = {
      name: project.name,
      icons: icons.map((i) => ({
        name: i.name,
        content: i.content,
        style: i.style,
        width: i.width,
        height: i.height,
        tags: i.tags,
        source: i.source,
      })),
    };
    downloadBlob(
      project.name + ".json",
      new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    );
    showToast("JSON exported");
    onClose();
  };

  const exportSVGZip = async () => {
    setBusy(true);
    try {
      const zip = new JSZip();
      const used = new Map<string, number>();
      for (const i of icons) {
        zip.file(uniqueName(used, i.name, ".svg"), colorizeContent(i.content, color));
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(project.name + "-svg.zip", blob);
      showToast(`Exported ${icons.length} SVG`);
      onClose();
    } catch (e) {
      showToast("Export failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const exportPNGZip = async () => {
    setBusy(true);
    try {
      const zip = new JSZip();
      const used = new Map<string, number>();
      for (const i of icons) {
        const svg = colorizeContent(i.content, color);
        const blob = await rasterizeToBlob(svg, pngSize, safePadding);
        if (blob) zip.file(uniqueName(used, i.name, ".png"), blob);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(`${project.name}-png-${pngSize}.zip`, blob);
      showToast(`Exported ${icons.length} PNG · ${pngSize}px`);
      onClose();
    } catch (e) {
      showToast("Export failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const copySVGList = () => {
    const txt = icons
      .map((i) => `<!-- ${i.name} -->\n${colorizeContent(i.content, color)}`)
      .join("\n\n");
    void navigator.clipboard.writeText(txt);
    showToast(`Copied ${icons.length} SVG to clipboard`);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal export-modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h2>Export · {project.name}</h2>
          <button type="button" className="icon-btn" onClick={onClose}>
            <Icon name="x" size={14} />
          </button>
        </header>

        <div className="export-meta">
          {icons.length} icons
        </div>

        <section className="export-section">
          <div className="export-section-head">
            <span>Color</span>
          </div>
          <div className="color-row">
            {PRESET_COLORS.map((c) => (
              <span
                key={c}
                className={
                  "swatch" + (color.toLowerCase() === c.toLowerCase() ? " active" : "")
                }
                style={{ background: c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
            <div className="color-input-wrap">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
              <input
                className="hex"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="png-options">
          <div className="png-options-head">
            <span>PNG options</span>
          </div>
          <div className="png-options-body">
            <div className="png-options-controls">
              <label className="png-field">
                <span className="png-field-label">Size (px)</span>
                <div className="png-field-input">
                  <input
                    type="number"
                    min={8}
                    max={2048}
                    step={1}
                    value={pngSize}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) setPngSize(v);
                    }}
                  />
                </div>
                <div className="png-presets">
                  {PNG_SIZE_PRESETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={"png-preset" + (pngSize === s ? " active" : "")}
                      onClick={() => setPngSize(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </label>
              <label className="png-field">
                <span className="png-field-label">
                  Padding (px) <span className="png-field-meta">max {maxPadding}</span>
                </span>
                <div className="png-field-input">
                  <input
                    type="number"
                    min={0}
                    max={maxPadding}
                    step={1}
                    value={safePadding}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      if (!isNaN(v)) setPngPadding(v);
                    }}
                  />
                  <input
                    type="range"
                    min={0}
                    max={maxPadding}
                    step={1}
                    value={safePadding}
                    onChange={(e) => setPngPadding(parseInt(e.target.value, 10))}
                  />
                </div>
              </label>
            </div>
            <div className="png-preview-wrap">
              <div className="png-preview-label">Preview</div>
              <div
                className={"png-preview png-preview-" + previewBg}
                style={{ width: PREVIEW_BOX, height: PREVIEW_BOX }}
                title={`${pngSize}×${pngSize}px`}
              >
                {previewUrl && previewIcon ? (
                  <img src={previewUrl} alt={previewIcon.name} draggable={false} />
                ) : previewIcon ? (
                  <RenderedIcon icon={previewIcon} size={null} color={color} />
                ) : (
                  <div className="png-preview-empty">No icons</div>
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
                      (previewBg === bg.value ? " active" : "")
                    }
                    onClick={() => setPreviewBg(bg.value)}
                    title={bg.title}
                    aria-label={bg.title}
                  />
                ))}
              </div>
              <div className="png-preview-meta">
                {pngSize}×{pngSize}
                {safePadding > 0 ? ` · pad ${safePadding}` : ""}
              </div>
            </div>
          </div>
        </section>

        <div className="export-grid">
          <button
            type="button"
            className="export-card"
            onClick={() => void exportSVGZip()}
            disabled={busy || icons.length === 0}
          >
            <div className="export-card-title">SVG zip</div>
            <div className="export-card-hint">{icons.length} files · current color</div>
          </button>
          <button
            type="button"
            className="export-card"
            onClick={() => void exportPNGZip()}
            disabled={busy || icons.length === 0}
          >
            <div className="export-card-title">PNG zip</div>
            <div className="export-card-hint">
              {pngSize}×{pngSize}
              {safePadding > 0 ? ` · pad ${safePadding}` : ""} · {icons.length} files
            </div>
          </button>
          <button
            type="button"
            className="export-card"
            onClick={exportJSON}
            disabled={busy || icons.length === 0}
          >
            <div className="export-card-title">JSON</div>
            <div className="export-card-hint">Full data · re-importable</div>
          </button>
          <button
            type="button"
            className="export-card"
            onClick={copySVGList}
            disabled={busy || icons.length === 0}
          >
            <div className="export-card-title">Copy SVG list</div>
            <div className="export-card-hint">Concatenated to clipboard</div>
          </button>
        </div>
      </div>
    </div>
  );
}
