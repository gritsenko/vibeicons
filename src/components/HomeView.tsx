import { useMemo } from "react";
import type { IconRecord, SourcesMap } from "../types";
import { RenderedIcon } from "./RenderedIcon";

interface Props {
  icons: IconRecord[];
  sources: SourcesMap;
  fgColor: string;
  onPickIcon: (key: string) => void;
  onPickSource: (source: string | null) => void;
  onPickStyle: (style: string) => void;
}

const SAMPLES_PER_STYLE = 24;
const BUILTIN_LABEL = "Built-in";

interface StyleBucket {
  style: string;
  total: number;
  samples: IconRecord[];
}

interface SourceBucket {
  source: string | null;
  label: string;
  total: number;
  styles: StyleBucket[];
}

export function HomeView({
  icons,
  sources,
  fgColor,
  onPickIcon,
  onPickSource,
  onPickStyle,
}: Props) {
  const buckets = useMemo<SourceBucket[]>(() => {
    const bySource = new Map<string | null, Map<string, IconRecord[]>>();
    for (const ic of icons) {
      const src = ic.source ?? null;
      let styleMap = bySource.get(src);
      if (!styleMap) {
        styleMap = new Map();
        bySource.set(src, styleMap);
      }
      const st = ic.style || "other";
      const list = styleMap.get(st);
      if (list) list.push(ic);
      else styleMap.set(st, [ic]);
    }

    const result: SourceBucket[] = [];
    for (const [src, styleMap] of bySource.entries()) {
      const styles: StyleBucket[] = [];
      let total = 0;
      for (const [style, list] of styleMap.entries()) {
        total += list.length;
        styles.push({
          style,
          total: list.length,
          samples: list.slice(0, SAMPLES_PER_STYLE),
        });
      }
      styles.sort((a, b) => b.total - a.total || a.style.localeCompare(b.style));
      result.push({
        source: src,
        label: src ?? BUILTIN_LABEL,
        total,
        styles,
      });
    }

    result.sort((a, b) => {
      if (a.source === null) return 1;
      if (b.source === null) return -1;
      return a.label.localeCompare(b.label);
    });
    return result;
  }, [icons]);

  if (buckets.length === 0) {
    return (
      <div className="grid-wrap">
        <div className="empty-state">
          <h3>No libraries yet</h3>
          <p>Import a JSON file with icon definitions to see libraries here.</p>
        </div>
      </div>
    );
  }

  const totalLibraries = buckets.length;
  const totalIcons = buckets.reduce((s, b) => s + b.total, 0);

  return (
    <div className="home-view">
      <div className="home-intro">
        <h2>Home</h2>
        <p>
          Compare {totalIcons.toLocaleString()} icons across {totalLibraries}{" "}
          {totalLibraries === 1 ? "library" : "libraries"}. Each library lists
          its styles with sample icons so you can spot the look at a glance.
        </p>
      </div>

      {buckets.map((bucket) => {
        const sourceMeta = bucket.source ? sources[bucket.source] : null;
        const reportedTotal = sourceMeta?.count ?? bucket.total;
        return (
          <section key={bucket.label} className="home-source">
            <header className="home-source-head">
              <button
                type="button"
                className="home-source-title"
                onClick={() => onPickSource(bucket.source)}
                title={
                  bucket.source
                    ? `Filter by ${bucket.label}`
                    : "Built-in seed icons"
                }
              >
                <span className="home-source-name">{bucket.label}</span>
                <span className="home-source-count">
                  {reportedTotal.toLocaleString()}
                </span>
              </button>
              <div className="home-source-meta">
                {bucket.styles.length}{" "}
                {bucket.styles.length === 1 ? "style" : "styles"}
              </div>
            </header>

            <div className="home-style-list">
              {bucket.styles.map((sb) => (
                <div key={sb.style} className="home-style">
                  <div className="home-style-head">
                    <button
                      type="button"
                      className="home-style-title"
                      onClick={() => onPickStyle(sb.style)}
                      title={`Filter by style: ${sb.style}`}
                    >
                      <span className="home-style-dot" />
                      {sb.style}
                    </button>
                    <span className="home-style-count">
                      {sb.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="home-sample-row">
                    {sb.samples.map((ic) => (
                      <button
                        key={ic.key}
                        type="button"
                        className="home-sample"
                        onClick={() => onPickIcon(ic.key)}
                        title={ic.name}
                      >
                        <RenderedIcon icon={ic} size={null} color={fgColor} />
                      </button>
                    ))}
                    {sb.total > sb.samples.length && (
                      <button
                        type="button"
                        className="home-sample home-sample-more"
                        onClick={() => onPickStyle(sb.style)}
                        title={`See all ${sb.total} ${sb.style} icons`}
                      >
                        +{(sb.total - sb.samples.length).toLocaleString()}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
