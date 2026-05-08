import type { SourcesMap } from "../types";

/** Longest matching source prefix `name:` so nested names like `Foo` vs `Foo Bar` resolve correctly. */
export function librarySourceForScopedId(
  id: string | number,
  sources: SourcesMap,
): string | null {
  const s = String(id);
  let best: string | null = null;
  let bestLen = -1;
  for (const name of Object.keys(sources)) {
    const p = name + ":";
    if (s.startsWith(p) && name.length > bestLen) {
      best = name;
      bestLen = name.length;
    }
  }
  return best;
}
