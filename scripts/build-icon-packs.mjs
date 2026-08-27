// Copies the bundled icon packs (Core/Flex/Plump, MyUA) into public/libraries/
// and writes one catalog manifest per pack.
//
// The source JSONs are large art assets kept outside the repo, so a missing
// pack is a warning, not an error — a clone without the assets still builds
// (the catalog just lists nothing from that pack). Override the location with
// ICON_PACKS_DIR. Run via npm run build:icons (also wired to prebuild/predev).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PACKS_DIR = process.env.ICON_PACKS_DIR || "C:/GameDevAssets/icons";
const OUT = path.join(ROOT, "public/libraries");

// dir: subdirectory of PACKS_DIR · manifest: catalog file the app fetches
// (referenced from public/preset.json).
const PACKS = [
  { dir: "Core Line", manifest: "core-index.json" },
  { dir: "MyUA", manifest: "myua-index.json" },
];

// File names in the asset folders are inconsistent ("Plump line.json", and
// "Сore Solid.json" whose first letter is a Cyrillic С) — normalise both the
// display name and the output file name.
const CYR = { С: "C", с: "c", о: "o", е: "e", а: "a", р: "p", у: "y", х: "x" };
const latinise = (s) => s.replace(/[\u0400-\u04FF]/g, (c) => CYR[c] ?? c);
// Title-case only the words that carry no internal capitals, so "Plump line"
// becomes "Plump Line" while an acronym like "MyUA" survives untouched.
const titleCase = (s) =>
  s.replace(/\S+/g, (w) =>
    /[A-Z]/.test(w.slice(1)) ? w : w[0].toUpperCase() + w.slice(1).toLowerCase(),
  );
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The app rewrites fills and strokes to currentColor at import time, so the
// wrapper classes and per-path colours these files carry are dead weight. Only
// safe to drop the fills when the root <svg> does not declare fill="none" —
// with it, a path without its own fill would inherit "none" and vanish.
function shrink(svg) {
  const open = svg.match(/<svg\b[^>]*>/i);
  const rootFillNone = Boolean(open && /\bfill\s*=\s*"none"/i.test(open[0]));
  let out = svg.replace(/\s+class="nc-icon-wrapper"/g, "");
  if (!rootFillNone) {
    out = out
      .replace(/\s+stroke="none"/g, "")
      .replace(/\s+fill="#[0-9A-Fa-f]{3,8}"/g, "")
      .replace(/<svg\b(?![^>]*\bfill=)/i, '<svg fill="currentColor"');
  }
  return out;
}

if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

const written = new Map(); // output file -> pack, to catch cross-pack collisions

for (const pack of PACKS) {
  const src = path.join(PACKS_DIR, pack.dir);
  const manifestPath = path.join(OUT, pack.manifest);
  if (!fs.existsSync(src)) {
    console.warn(`[icon-packs] missing dir: ${src} — skipping (set ICON_PACKS_DIR to override)`);
    fs.writeFileSync(manifestPath, JSON.stringify({ libraries: [] }, null, 2));
    continue;
  }

  const files = fs.readdirSync(src).filter((f) => f.toLowerCase().endsWith(".json")).sort();
  const libraries = [];

  for (const file of files) {
    let lib;
    try {
      lib = JSON.parse(fs.readFileSync(path.join(src, file), "utf-8"));
    } catch (e) {
      console.warn(`[icon-packs] ${pack.dir}/${file}: invalid JSON — skipped (${e.message})`);
      continue;
    }
    const icons = Array.isArray(lib.icons) ? lib.icons : [];
    if (!icons.length) {
      console.warn(`[icon-packs] ${pack.dir}/${file}: no icons — skipped`);
      continue;
    }
    for (const icon of icons) {
      if (typeof icon.content === "string") icon.content = shrink(icon.content);
    }
    const source = titleCase(latinise(path.basename(file, path.extname(file))).trim());
    const outFile = `${slug(source)}.json`;
    const clash = written.get(outFile);
    if (clash) {
      console.warn(`[icon-packs] ${pack.dir}/${file}: "${outFile}" already written by ${clash} — skipped`);
      continue;
    }
    const json = JSON.stringify({ icons, sets: lib.sets ?? [], groups: lib.groups ?? [] });
    fs.writeFileSync(path.join(OUT, outFile), json);
    written.set(outFile, pack.dir);
    libraries.push({ file: outFile, source, count: icons.length, bytes: Buffer.byteLength(json) });
    console.log(`[icon-packs] ${source}: ${icons.length} icons -> ${outFile} (${(json.length / 1e6).toFixed(1)} MB)`);
  }

  libraries.sort((a, b) => a.source.localeCompare(b.source));
  fs.writeFileSync(manifestPath, JSON.stringify({ libraries }, null, 2));
  console.log(`[icon-packs] ${pack.dir} -> ${pack.manifest} (${libraries.length} libs)`);
}
