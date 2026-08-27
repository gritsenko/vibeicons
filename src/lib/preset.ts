// Preset (first-run) icon libraries.
//
// `public/preset.json` lists the libraries the app initialises itself with on a
// cold start. Entries are either a single import-ready library JSON (`kind:
// "library"`, the default) or a manifest that lists several of them (`kind:
// "manifest"` — the shape written by scripts/build-ant-icons.mjs into
// public/libraries/index.json). Relative URLs resolve against Vite's BASE_URL,
// absolute http(s) URLs are fetched as-is.

export interface PresetEntry {
  /** Library JSON URL, or manifest URL when kind === "manifest". */
  url: string;
  /** Source name (namespacing key). Defaults to the URL's base name. */
  name?: string;
  kind?: "library" | "manifest";
  /** Import without asking on a first run. Defaults to false: the library is
   *  only offered in the catalog (empty state / Settings) and imported on
   *  demand — the icon packs are far too large to push onto every visitor. */
  auto?: boolean;
  /** Catalog heading this entry's libraries are listed under. */
  collection?: string;
}

export interface PresetFile {
  version?: number;
  sources?: PresetEntry[];
}

/** One concrete library to import: a source name plus a resolved URL. */
export interface PresetSource {
  name: string;
  url: string;
  /** Imported automatically on a first run (see PresetEntry.auto). */
  auto: boolean;
  /** Catalog heading, when the entry declares one. */
  collection?: string;
  /** Icon count, when the manifest records it — catalog display only. */
  count?: number;
  /** Library size in bytes, when the manifest records it — catalog display only. */
  bytes?: number;
}

interface ManifestFile {
  libraries?: Array<{ file: string; source?: string; count?: number; bytes?: number }>;
}

/** localStorage flag marking "the preset has already been applied on this device".
 *  Deliberately outside the `vibeicons.v1` prefix so `clearAllStorage()` (the
 *  regular "Clear all data") does not silently re-arm the first-run import —
 *  only the explicit full reset clears it. */
const PRESET_FLAG = "vibeicons.preset.v1.init";

export function isPresetInitialized(): boolean {
  try {
    return localStorage.getItem(PRESET_FLAG) != null;
  } catch {
    return false;
  }
}

export function markPresetInitialized(): void {
  try {
    localStorage.setItem(PRESET_FLAG, new Date().toISOString());
  } catch {
    /* ignore */
  }
}

export function clearPresetInitialized(): void {
  try {
    localStorage.removeItem(PRESET_FLAG);
  } catch {
    /* ignore */
  }
}

function baseHref(): string {
  return new URL(import.meta.env.BASE_URL, window.location.href).href;
}

function resolve(url: string, base: string): string {
  return new URL(url, base).href;
}

function nameFromUrl(url: string): string {
  const last = url.split(/[?#]/)[0].split("/").filter(Boolean).pop() ?? "Preset";
  return last.replace(/\.json$/i, "") || "Preset";
}

/** Fetch preset.json and expand it into a flat list of libraries to import.
 *  Never throws — a missing/broken preset just yields an empty list. */
export async function loadPresetSources(): Promise<PresetSource[]> {
  const base = baseHref();
  let file: PresetFile;
  try {
    const res = await fetch(resolve("preset.json", base), { cache: "no-cache" });
    if (!res.ok) {
      console.warn(`[preset] preset.json → HTTP ${res.status}`);
      return [];
    }
    file = (await res.json()) as PresetFile;
  } catch (e) {
    console.warn("[preset] preset.json load failed:", e);
    return [];
  }

  const out: PresetSource[] = [];
  const seen = new Set<string>();
  const push = (src: PresetSource) => {
    if (!src.name || !src.url || seen.has(src.name)) return;
    seen.add(src.name);
    out.push(src);
  };

  for (const entry of file.sources ?? []) {
    if (!entry || typeof entry.url !== "string" || !entry.url) continue;
    const url = resolve(entry.url, base);
    const auto = entry.auto === true;
    if (entry.kind !== "manifest") {
      push({ name: entry.name ?? nameFromUrl(url), url, auto, collection: entry.collection });
      continue;
    }
    try {
      const res = await fetch(url, { cache: "no-cache" });
      if (!res.ok) {
        console.warn(`[preset] manifest ${entry.url} → HTTP ${res.status}`);
        continue;
      }
      const manifest = (await res.json()) as ManifestFile;
      for (const lib of manifest.libraries ?? []) {
        if (!lib || typeof lib.file !== "string") continue;
        const libUrl = resolve(lib.file, url);
        push({
          name: lib.source ?? nameFromUrl(libUrl),
          url: libUrl,
          auto,
          collection: entry.collection ?? entry.name,
          count: typeof lib.count === "number" ? lib.count : undefined,
          bytes: typeof lib.bytes === "number" ? lib.bytes : undefined,
        });
      }
    } catch (e) {
      console.warn(`[preset] manifest ${entry.url} load failed:`, e);
    }
  }

  return out;
}
