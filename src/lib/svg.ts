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

export function downloadPNG(name: string, content: string, color: string, size = 256): void {
  const svg = colorizeContent(content, color);
  const blob = new Blob([svg], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d");
    if (!ctx) {
      URL.revokeObjectURL(url);
      return;
    }
    ctx.drawImage(img, 0, 0, size, size);
    c.toBlob((b) => {
      if (b) downloadBlob(name + ".png", b);
      URL.revokeObjectURL(url);
    });
  };
  img.src = url;
}
