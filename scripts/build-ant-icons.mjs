// Generates import-ready JSON libraries from @ant-design/icons-svg.
// Output: public/libraries/ant-{outlined,filled,twotone}.json + index.json
// Run via npm run build:icons (also wired to prebuild / predev).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "node_modules/@ant-design/icons-svg/inline-svg");
const OUT = path.join(ROOT, "public/libraries");

const THEMES = [
  { theme: "outlined", source: "Ant Design Outlined", setLabel: "Outlined" },
  { theme: "filled", source: "Ant Design Filled", setLabel: "Filled" },
  { theme: "twotone", source: "Ant Design TwoTone", setLabel: "TwoTone" },
];

// Inject fill="currentColor" on the root <svg> so default-coloured paths
// inherit the parent style.color cascade. Existing fills on inner paths are
// rewritten to currentColor by the app's preprocessor at import time.
function injectRootFill(svg) {
  return svg.replace(/<svg\b([^>]*)>/, (m, attrs) => {
    if (/\bfill\s*=/.test(attrs)) return m;
    return `<svg fill="currentColor"${attrs}>`;
  });
}

function nameToTags(name) {
  // "align-center-outlined" -> "align,center"
  return name
    .split("-")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(",");
}

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const manifest = [];

for (const { theme, source, setLabel } of THEMES) {
  const dir = path.join(SRC, theme);
  if (!fs.existsSync(dir)) {
    console.warn(`[ant-icons] missing dir: ${dir} — did you 'npm install'?`);
    continue;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".svg")).sort();
  const setId = theme;
  const icons = files.map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), "utf-8").trim();
    const content = injectRootFill(raw);
    const name = file.replace(/\.svg$/, "");
    return {
      name,
      content,
      style: theme,
      width: 1024,
      height: 1024,
      set_id: setId,
      tags: nameToTags(name),
    };
  });

  const lib = {
    icons,
    sets: [{ id: setId, label: setLabel, group_id: null }],
    groups: [],
  };

  const fileName = `ant-${theme}.json`;
  fs.writeFileSync(path.join(OUT, fileName), JSON.stringify(lib));
  manifest.push({ file: fileName, source, count: icons.length });
  console.log(`[ant-icons] ${icons.length} icons -> ${fileName}`);
}

fs.writeFileSync(
  path.join(OUT, "index.json"),
  JSON.stringify({ libraries: manifest }, null, 2),
);
console.log(`[ant-icons] manifest -> index.json (${manifest.length} libs)`);
