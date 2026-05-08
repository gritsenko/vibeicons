export function highlightSvg(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/(&lt;\/?)([\w\-:]+)/g, '$1<span class="ln-tag">$2</span>')
    .replace(/(\s)([\w\-:]+)(=)/g, '$1<span class="ln-attr">$2</span>$3')
    .replace(/("[^"]*")/g, '<span class="ln-str">$1</span>');
}

export function colorizeContent(svgString: string, color: string): string {
  return svgString
    .replace(/fill="(?!none")[^"]*"/g, `fill="${color}"`)
    .replace(/fill='(?!none')[^']*'/g, `fill='${color}'`);
}

const RX_SVG_OPEN = /<svg\b([^>]*)>/i;
const RX_WIDTH = /\s+width="[^"]*"/i;
const RX_HEIGHT = /\s+height="[^"]*"/i;
const RX_VIEWBOX = /viewBox="[^"]*"/i;
const RX_PRESERVE = /preserveAspectRatio="[^"]*"/i;

/**
 * One-shot SVG normalization done at import time so per-render rewrites are
 * unnecessary. Strips width/height, ensures viewBox + preserveAspectRatio, and
 * rewrites every `fill="..."` (except `fill="none"`) to `currentColor`. The
 * resulting markup picks up its color from the parent's `style.color`.
 */
export function preprocessSvgContent(content: string, w?: number, h?: number): string {
  if (!content) return content;
  let out = content;

  out = out.replace(RX_SVG_OPEN, (_match, attrs: string) => {
    let a = attrs;
    a = a.replace(RX_WIDTH, "");
    a = a.replace(RX_HEIGHT, "");
    if (!RX_PRESERVE.test(a)) a += ' preserveAspectRatio="xMidYMid meet"';
    if (!RX_VIEWBOX.test(a)) {
      const vw = Number(w) || 24;
      const vh = Number(h) || 24;
      a += ` viewBox="0 0 ${vw} ${vh}"`;
    }
    return `<svg${a}>`;
  });

  // currentColor swap (skip fill="none" / fill='none')
  out = out.replace(/fill="(?!none")[^"]*"/g, 'fill="currentColor"');
  out = out.replace(/fill='(?!none')[^']*'/g, "fill='currentColor'");

  return out;
}

export function downloadBlob(name: string, blob: Blob): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function downloadSVG(name: string, content: string, color: string): void {
  const svg = colorizeContent(content, color);
  downloadBlob(name + ".svg", new Blob([svg], { type: "image/svg+xml" }));
}

/** Rasterize SVG markup to a PNG blob at exact pixel dimensions (used for previews and zip export). */
export function rasterizeSvgToPngBlob(
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

export function downloadPNG(
  name: string,
  content: string,
  color: string,
  size = 256,
  padding = 0,
): void {
  const svg = colorizeContent(content, color);
  void rasterizeSvgToPngBlob(svg, size, padding).then((b) => {
    if (b) downloadBlob(name + ".png", b);
  });
}
