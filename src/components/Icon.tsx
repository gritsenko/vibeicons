const PATHS: Record<string, string> = {
  grid: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  star: "M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z",
  clock: "M12 7v5l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  folder: "M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  upload: "M12 16V4M6 10l6-6 6 6M4 20h16",
  search: "M11 4a7 7 0 100 14 7 7 0 000-14zm10 16l-5-5",
  download: "M12 4v12M6 12l6 6 6-6M4 22h16",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  moon: "M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z",
  sun: "M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z",
  settings:
    "M12 8a4 4 0 100 8 4 4 0 000-8zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  x: "M18 6L6 18M6 6l12 12",
  plus: "M12 5v14M5 12h14",
  inbox: "M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v6a2 2 0 01-2 2H4a2 2 0 01-2-2v-6z",
  code: "M16 18l6-6-6-6M8 6l-6 6 6 6",
  layers: "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  palette:
    "M12 2C6 2 2 6 2 12c0 5 4 9 9 9 1.5 0 2-1 2-2 0-.5-.3-1-.6-1.4-.4-.5-.6-1-.6-1.6 0-1 .8-2 2-2h2c2.8 0 5-2.2 5-5C21 5 17 2 12 2z",
  check: "M5 13l4 4L19 7",
  trash: "M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6",
  home: "M3 11l9-8 9 8M5 9v11h5v-6h4v6h5V9",
  rows: "M3 5h18M3 12h18M3 19h18",
  refresh:
    "M21 12a9 9 0 01-9 9 9 9 0 01-8.5-6M3 12a9 9 0 019-9 9 9 0 018.5 6M3 4v5h5M21 20v-5h-5",
};

interface Props {
  name: string;
  size?: number;
}

export function Icon({ name, size = 14 }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
    >
      <path d={PATHS[name] ?? PATHS.grid} />
    </svg>
  );
}
