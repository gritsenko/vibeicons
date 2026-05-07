import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { IconRecord } from "../types";
import { Icon } from "./Icon";
import { RenderedIcon } from "./RenderedIcon";

interface Props {
  items: IconRecord[];
  selectedKey: string | null;
  favoriteKeys: Set<string>;
  showLabels: boolean;
  fgColor: string;
  tileMin: number;
  onSelect: (key: string) => void;
  onToggleFav: (key: string) => void;
}

const GAP = 6;
const ROW_BUFFER = 4;

export function IconGrid({
  items,
  selectedKey,
  favoriteKeys,
  showLabels,
  fgColor,
  tileMin,
  onSelect,
  onToggleFav,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useLayoutEffect(() => {
    const scroll = scrollRef.current;
    const canvas = canvasRef.current;
    if (!scroll || !canvas) return;
    const update = () => {
      setWidth(canvas.clientWidth);
      setViewportH(scroll.clientHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(scroll);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const cols =
    width > 0 ? Math.max(1, Math.floor((width + GAP) / (tileMin + GAP))) : 1;
  const tileSize = cols > 0 && width > 0
    ? Math.floor((width - (cols - 1) * GAP) / cols)
    : tileMin;
  const rowHeight = tileSize + GAP;
  const totalRows = Math.ceil(items.length / cols);
  const totalHeight = totalRows > 0 ? totalRows * rowHeight - GAP : 0;

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - ROW_BUFFER);
  const endRow = Math.min(
    totalRows - 1,
    Math.ceil((scrollTop + viewportH) / rowHeight) + ROW_BUFFER,
  );

  // When the filtered list reference changes (e.g. new search/filter), reset to top.
  const lastItemsRef = useRef(items);
  useEffect(() => {
    if (lastItemsRef.current !== items) {
      lastItemsRef.current = items;
      const el = scrollRef.current;
      if (el && el.scrollTop > 0) {
        el.scrollTop = 0;
        setScrollTop(0);
      }
    }
  }, [items]);

  // Keep the selected tile in view when navigated by keyboard (selectedKey
  // changes from outside the grid).
  useEffect(() => {
    if (!selectedKey || items.length === 0 || cols === 0) return;
    const idx = items.findIndex((i) => i.key === selectedKey);
    if (idx < 0) return;
    const row = Math.floor(idx / cols);
    const top = row * rowHeight;
    const bottom = top + tileSize;
    const el = scrollRef.current;
    if (!el) return;
    if (top < el.scrollTop) {
      el.scrollTop = top;
    } else if (bottom > el.scrollTop + el.clientHeight) {
      el.scrollTop = bottom - el.clientHeight;
    }
  }, [selectedKey, cols, rowHeight, tileSize, items]);

  const cells = useMemo(() => {
    if (items.length === 0 || cols === 0) return null;
    const out: React.ReactNode[] = [];
    for (let r = startRow; r <= endRow; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        if (idx >= items.length) break;
        const ic = items[idx];
        out.push(
          <Tile
            key={ic.key}
            icon={ic}
            top={r * rowHeight}
            left={c * (tileSize + GAP)}
            size={tileSize}
            isSelected={selectedKey === ic.key}
            isFav={favoriteKeys.has(ic.key)}
            showLabel={showLabels}
            fgColor={fgColor}
            onSelect={onSelect}
            onToggleFav={onToggleFav}
          />,
        );
      }
    }
    return out;
  }, [
    items,
    cols,
    tileSize,
    rowHeight,
    startRow,
    endRow,
    selectedKey,
    favoriteKeys,
    showLabels,
    fgColor,
    onSelect,
    onToggleFav,
  ]);

  if (items.length === 0) {
    return (
      <div className="grid-wrap">
        <div className="empty-state">
          <Icon name="inbox" size={40} />
          <h3>No icons match</h3>
          <p>Try a different search or filter, or import a JSON file with icon definitions.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="virt-scroll"
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      <div ref={canvasRef} className="virt-canvas" style={{ height: totalHeight }}>
        {cells}
      </div>
    </div>
  );
}

interface TileProps {
  icon: IconRecord;
  top: number;
  left: number;
  size: number;
  isSelected: boolean;
  isFav: boolean;
  showLabel: boolean;
  fgColor: string;
  onSelect: (key: string) => void;
  onToggleFav: (key: string) => void;
}

const Tile = memo(function Tile({
  icon,
  top,
  left,
  size,
  isSelected,
  isFav,
  showLabel,
  fgColor,
  onSelect,
  onToggleFav,
}: TileProps) {
  return (
    <div
      className={
        "tile" +
        (isSelected ? " selected" : "") +
        (isFav ? " is-fav" : "") +
        (showLabel ? " show-label" : "")
      }
      style={{
        position: "absolute",
        top,
        left,
        width: size,
        height: size,
      }}
      onClick={() => onSelect(icon.key)}
      onDoubleClick={() => onToggleFav(icon.key)}
      title={icon.name + (icon.source ? " · " + icon.source : "")}
    >
      <RenderedIcon icon={icon} size={null} color={fgColor} />
      <span className="tile-fav">
        <Icon name="star" size={11} />
      </span>
      <span className="tile-label">{icon.name}</span>
      {icon.source && <span className="tile-source">{icon.source}</span>}
    </div>
  );
});
