import { useEffect, useState } from "react";

const REPO = "gritsenko/vibeicons";
const REPO_URL = `https://github.com/${REPO}`;
const API_URL = `https://api.github.com/repos/${REPO}`;
const CACHE_KEY = "vibeicons.v1.gh.stars";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;

type Cached = { stars: number; ts: number };

function formatStars(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + "k";
  return String(n);
}

export function GitHubLink() {
  const [stars, setStars] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw) as Cached;
      return typeof c.stars === "number" ? c.stars : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as Cached;
        if (Date.now() - c.ts < CACHE_TTL_MS) return;
      }
    } catch {
      /* ignore */
    }
    const ac = new AbortController();
    void (async () => {
      try {
        const r = await fetch(API_URL, {
          signal: ac.signal,
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!r.ok) return;
        const j = (await r.json()) as { stargazers_count?: number };
        if (typeof j.stargazers_count === "number") {
          setStars(j.stargazers_count);
          try {
            localStorage.setItem(
              CACHE_KEY,
              JSON.stringify({ stars: j.stargazers_count, ts: Date.now() }),
            );
          } catch {
            /* ignore quota */
          }
        }
      } catch {
        /* network/offline — keep cached value if any */
      }
    })();
    return () => ac.abort();
  }, []);

  return (
    <a
      className="gh-link"
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="View VibeIcons on GitHub"
    >
      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8 0C3.58 0 0 3.58 0 8a8 8 0 005.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 014 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"
        />
      </svg>
      <span className="gh-link-label">GitHub</span>
      {stars != null && <span className="gh-link-stars">★ {formatStars(stars)}</span>}
    </a>
  );
}
