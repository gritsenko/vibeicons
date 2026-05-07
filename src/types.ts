export type IconStyle = "glyph" | "line" | "outline" | "solid" | "other" | string;

export interface IconRecord {
  name: string;
  content: string;
  style: IconStyle;
  width: number;
  height: number;
  set_id: string | number | null;
  tags: string;
  source: string | null;
}

export interface SetMeta {
  id: string | number;
  label: string;
  group_id: string | number | null;
}

export interface GroupMeta {
  id: string | number;
  label: string;
  group_id: string | number | null;
}

export interface SourceMeta {
  name: string;
  count: number;
}

export interface Tweaks {
  theme: "light" | "dark";
  density: "compact" | "comfortable" | "spacious";
  accent: string;
  showLabels: boolean;
}

export interface ImportFile {
  icons?: unknown;
  sets?: Array<{ id: number | string; label?: string; group_id?: number | string | null }>;
  groups?: Array<{ id: number | string; label?: string; group_id?: number | string | null }>;
}

export type SetsMetaMap = Record<string, SetMeta>;
export type GroupsMetaMap = Record<string, GroupMeta>;
export type SourcesMap = Record<string, SourceMeta>;
