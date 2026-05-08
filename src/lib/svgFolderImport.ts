import type { GroupMeta, IconRecord, SetMeta, SourcesMap } from "../types";
import { buildSearch, iconKey } from "./icons";
import { preprocessSvgContent } from "./svg";

/** File from `<input webkitdirectory>` — relative paths under the picked folder. */
export type FileWithRelativePath = File & { webkitRelativePath?: string };

/** Explicit path (drag-drop folder API does not set webkitRelativePath). */
export type SvgFolderFileEntry = { file: File; relativePath: string };

export type SvgFolderImportOutcome =
  | {
      ok: true;
      sourceName: string;
      icons: IconRecord[];
      groups: GroupMeta[];
      sets: SetMeta[];
      skipped: number;
    }
  | { ok: false; message: string };

export function tagsFromFilenameStem(stem: string): string[] {
  return stem
    .split("-")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
}

export function tagsFromTxtContent(content: string): string[] {
  const out: string[] = [];
  const normalized = content.replace(/\r\n/g, "\n");
  for (const line of normalized.split("\n")) {
    for (const piece of line.split(",")) {
      const t = piece.trim().toLowerCase();
      if (t) out.push(t);
    }
  }
  return out;
}

/** Filename-derived tags first, then *.txt tags; trimmed, lowercased, deduped. */
export function mergeIconTags(filenameStem: string, txtBody?: string): string {
  const seen = new Set<string>();
  const ordered: string[] = [];
  const pushArr = (arr: string[]) => {
    for (const t of arr) {
      if (!seen.has(t)) {
        seen.add(t);
        ordered.push(t);
      }
    }
  };
  pushArr(tagsFromFilenameStem(filenameStem));
  if (txtBody != null && txtBody.trim() !== "") pushArr(tagsFromTxtContent(txtBody));
  return ordered.join(",");
}

export function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

function parseSvgDimensions(svg: string): { width: number; height: number } {
  const viewBox = svg.match(/viewBox=["']([^"']+)["']/i);
  if (viewBox) {
    const parts = viewBox[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length >= 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3])) {
      const w = parts[2];
      const h = parts[3];
      if (w > 0 && h > 0) return { width: w, height: h };
    }
  }
  const wm = svg.match(/\bwidth=["']([^"']+)["']/i);
  const hm = svg.match(/\bheight=["']([^"']+)["']/i);
  const pw = wm ? parseFloat(wm[1]) : NaN;
  const ph = hm ? parseFloat(hm[1]) : NaN;
  return {
    width: Number.isFinite(pw) && pw > 0 ? pw : 24,
    height: Number.isFinite(ph) && ph > 0 ? ph : 24,
  };
}

function allocateIconName(base: string, taken: Set<string>): string {
  const clean = base.trim() || "icon";
  if (!taken.has(clean)) {
    taken.add(clean);
    return clean;
  }
  for (let i = 1; i <= 9999; i++) {
    const cand = `${clean}-${String(i).padStart(2, "0")}`;
    if (!taken.has(cand)) {
      taken.add(cand);
      return cand;
    }
  }
  const fallback = `${clean}-${Date.now()}`;
  taken.add(fallback);
  return fallback;
}

function pickUniqueSourceName(desired: string, sources: SourcesMap): string {
  let name = desired.trim() || "Imported folder";
  const isTaken = (n: string) => Boolean(sources[n]);
  if (!isTaken(name)) return name;
  let n = 2;
  while (isTaken(name + " (" + n + ")")) n++;
  return name + " (" + n + ")";
}

/** Build entries from `<input type="file" webkitdirectory>`. */
export function fileListToFolderEntries(files: File[]): SvgFolderFileEntry[] {
  return Array.from(files).map((file) => ({
    file,
    relativePath: normalizePath(
      (file as FileWithRelativePath).webkitRelativePath ?? file.name,
    ),
  }));
}

/**
 * Walk drag-and-dropped files/folders (Chromium / Safari). Returns `null` to fall back to `dataTransfer.files`.
 */
export async function collectFolderEntriesFromDataTransfer(
  dt: DataTransfer,
): Promise<SvgFolderFileEntry[] | null> {
  const items = dt.items;
  if (!items?.length) return null;
  const first = items[0];
  if (typeof first.webkitGetAsEntry !== "function") return null;

  const out: SvgFolderFileEntry[] = [];

  async function readAllChildren(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
    const acc: FileSystemEntry[] = [];
    let batch: FileSystemEntry[];
    do {
      batch = await new Promise<FileSystemEntry[]>((resolve, reject) => {
        reader.readEntries(resolve, reject);
      });
      acc.push(...batch);
    } while (batch.length > 0);
    return acc;
  }

  async function walk(entry: FileSystemEntry, prefix: string): Promise<void> {
    if (entry.isFile) {
      await new Promise<void>((resolve, reject) => {
        (entry as FileSystemFileEntry).file(
          (file) => {
            const rel = normalizePath(prefix ? `${prefix}/${entry.name}` : entry.name);
            out.push({ file, relativePath: rel });
            resolve();
          },
          reject,
        );
      });
    } else if (entry.isDirectory) {
      const dir = entry as FileSystemDirectoryEntry;
      const nextPrefix = normalizePath(prefix ? `${prefix}/${dir.name}` : dir.name);
      const children = await readAllChildren(dir.createReader());
      await Promise.all(children.map((child) => walk(child, nextPrefix)));
    }
  }

  try {
    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (!entry) return null;
      await walk(entry, "");
    }
  } catch {
    return null;
  }

  return out.length ? out : null;
}

/**
 * Import a directory tree of SVG (+ optional sidecar .txt tags) as one library.
 */
export async function importSvgFolderFromEntries(
  entries: SvgFolderFileEntry[],
  sources: SourcesMap,
  existingIcons: IconRecord[],
): Promise<SvgFolderImportOutcome> {
  if (!entries.length) return { ok: false, message: "No files selected" };

  const paths = entries.map((e) => normalizePath(e.relativePath));
  const roots = new Set<string>();
  for (const p of paths) {
    const seg = p.split("/")[0];
    if (seg) roots.add(seg);
  }
  if (roots.size !== 1) {
    return {
      ok: false,
      message:
        roots.size === 0
          ? "Could not read folder structure (try another browser)"
          : "Select exactly one root folder",
    };
  }

  const rootFolderLabel = [...roots][0];
  const sourceName = pickUniqueSourceName(rootFolderLabel, sources);

  const svgEntries = entries.filter((e) => /\.svg$/i.test(e.file.name));
  if (!svgEntries.length) return { ok: false, message: "No SVG files found in this folder" };

  const txtEntries = entries.filter((e) => /\.txt$/i.test(e.file.name));
  const txtMap = new Map<string, string>();
  for (const te of txtEntries) {
    const path = normalizePath(te.relativePath);
    const segments = path.split("/");
    if (segments[0] !== rootFolderLabel) continue;
    const rel = segments.slice(1).join("/");
    const stemPath = rel.replace(/\.txt$/i, "");
    try {
      const body = await te.file.text();
      txtMap.set(stemPath.toLowerCase(), body);
    } catch {
      /* skip unreadable txt */
    }
  }

  const libraryGroupId = sourceName + ":__lib";
  const newGroups: GroupMeta[] = [
    { id: libraryGroupId, label: sourceName, group_id: null },
  ];
  const newSets: SetMeta[] = [];

  let gSeq = 0;
  let sSeq = 0;

  const pathToInnerGroup = new Map<string, string>();

  function ensureInnerGroupForDir(dirSegments: string[]): string {
    if (dirSegments.length === 0) return libraryGroupId;
    let parent = libraryGroupId;
    let acc = "";
    for (let i = 0; i < dirSegments.length; i++) {
      const seg = dirSegments[i];
      acc = acc === "" ? seg : acc + "/" + seg;
      let gid = pathToInnerGroup.get(acc);
      if (!gid) {
        gSeq++;
        gid = `${sourceName}:fg_${gSeq}`;
        newGroups.push({
          id: gid,
          label: seg,
          group_id: parent,
        });
        pathToInnerGroup.set(acc, gid);
      }
      parent = gid;
    }
    return parent;
  }

  const folderToSetId = new Map<string, string>();

  function ensureSetForFolder(dirSegments: string[]): string {
    const key = dirSegments.join("/");
    let sid = folderToSetId.get(key);
    if (sid) return sid;
    sSeq++;
    sid = `${sourceName}:fs_${sSeq}`;
    const innerGroup = ensureInnerGroupForDir(dirSegments);
    const label =
      dirSegments.length === 0 ? sourceName : dirSegments[dirSegments.length - 1];
    newSets.push({
      id: sid,
      label,
      group_id: innerGroup,
    });
    folderToSetId.set(key, sid);
    return sid;
  }

  const takenNames = new Set(
    existingIcons.filter((ic) => ic.source === sourceName).map((ic) => ic.name),
  );

  const newIcons: IconRecord[] = [];
  let skipped = 0;

  const sortedSvgs = svgEntries.slice().sort((a, b) =>
    normalizePath(a.relativePath).localeCompare(normalizePath(b.relativePath)),
  );

  for (const ent of sortedSvgs) {
    const path = normalizePath(ent.relativePath);
    const segments = path.split("/");
    if (segments[0] !== rootFolderLabel) {
      skipped++;
      continue;
    }
    const rest = segments.slice(1);
    const fileBase = rest.pop();
    if (!fileBase || !/\.svg$/i.test(fileBase)) {
      skipped++;
      continue;
    }
    const stem = fileBase.replace(/\.svg$/i, "");
    const dirSegments = rest;

    const txtLookup = [...dirSegments, stem].join("/").toLowerCase();
    const txtBody = txtMap.get(txtLookup);
    const tags = mergeIconTags(stem, txtBody);

    let rawSvg: string;
    try {
      rawSvg = await ent.file.text();
    } catch {
      skipped++;
      continue;
    }
    if (!rawSvg.trim()) {
      skipped++;
      continue;
    }

    const dims = parseSvgDimensions(rawSvg);
    const content = preprocessSvgContent(rawSvg, dims.width, dims.height);
    const iconName = allocateIconName(stem.trim() || "icon", takenNames);
    const setId = ensureSetForFolder(dirSegments);

    const rec: IconRecord = {
      key: "",
      name: iconName,
      content,
      style: "other",
      width: dims.width,
      height: dims.height,
      set_id: setId,
      tags,
      source: sourceName,
      search: buildSearch(iconName, tags, sourceName),
    };
    rec.key = iconKey(rec);
    newIcons.push(rec);
  }

  if (!newIcons.length) {
    return {
      ok: false,
      message: skipped ? `No icons imported (${skipped} skipped)` : "No icons imported",
    };
  }

  return {
    ok: true,
    sourceName,
    icons: newIcons,
    groups: newGroups,
    sets: newSets,
    skipped,
  };
}

/** Convenience: folder picker `FileList`. */
export async function importSvgFolderFromFiles(
  files: File[],
  sources: SourcesMap,
  existingIcons: IconRecord[],
): Promise<SvgFolderImportOutcome> {
  return importSvgFolderFromEntries(fileListToFolderEntries(files), sources, existingIcons);
}
