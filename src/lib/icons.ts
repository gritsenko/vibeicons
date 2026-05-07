import type { IconRecord } from "../types";
import { preprocessSvgContent } from "./svg";

export function iconKey(icon: { name: string; source: string | null }): string {
  return (icon.source ?? "") + "::" + icon.name;
}

export function buildSearch(name: string, tags: string, source: string | null): string {
  return (name + " " + (tags || "") + " " + (source || "")).toLowerCase();
}

/**
 * Normalize an icon entry coming from a JSON import. Returns null if the
 * record is unusable (missing name/content). The returned record has its
 * SVG already preprocessed and a precomputed lowercased search haystack.
 */
export function normalizeImportedIcon(
  raw: unknown,
  sourceName: string | null,
): IconRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (!obj.name || !obj.content) return null;

  let tags: string;
  if (Array.isArray(obj.tags)) tags = obj.tags.join(",");
  else if (obj.tags == null) tags = "";
  else tags = String(obj.tags);

  const name = String(obj.name);
  const width = Number(obj.width) || 48;
  const height = Number(obj.height) || 48;
  const content = preprocessSvgContent(String(obj.content), width, height);

  const rec: IconRecord = {
    key: "",
    name,
    content,
    style: (obj.style as string) || "other",
    width,
    height,
    set_id: (obj.set_id as string | number | null) ?? null,
    tags,
    source: sourceName,
    search: buildSearch(name, tags, sourceName),
  };
  rec.key = iconKey(rec);
  return rec;
}

/**
 * Re-process icons coming from the legacy v1 storage shape (raw SVG, no key,
 * no search field). Idempotent: if already processed, content is left alone.
 */
export function rehydrateLegacyIcon(raw: unknown): IconRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Partial<IconRecord> & Record<string, unknown>;
  if (!obj.name || !obj.content) return null;

  let tags = "";
  const rawTags = (obj as Record<string, unknown>).tags;
  if (Array.isArray(rawTags)) tags = rawTags.join(",");
  else if (typeof rawTags === "string") tags = rawTags;
  const source = (obj.source as string | null | undefined) ?? null;
  const width = Number(obj.width) || 48;
  const height = Number(obj.height) || 48;
  const name = String(obj.name);
  // Re-preprocess to ensure consistent shape (idempotent for already-processed content).
  const content = preprocessSvgContent(String(obj.content), width, height);

  const rec: IconRecord = {
    key: "",
    name,
    content,
    style: (obj.style as string) || "other",
    width,
    height,
    set_id: (obj.set_id as string | number | null) ?? null,
    tags,
    source,
    search: buildSearch(name, tags, source),
  };
  rec.key = iconKey(rec);
  return rec;
}
