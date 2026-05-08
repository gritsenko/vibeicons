import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { IconRecord } from "../types";
import { Icon } from "./Icon";
import { RenderedIcon } from "./RenderedIcon";

interface Props {
  items: IconRecord[];
  selectedKey: string | null;
  selectedKeys: Set<string>;
  favoriteKeys: Set<string>;
  showLabels: boolean;
  fgColor: string;
  tileMin: number;
  onSelect: (key: string, e: React.MouseEvent) => void;
  onActivate: (key: string) => void;
  onContext: (key: string, x: number, y: number) => void;
  onDragStart: (key: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
}

const GAP = 6;
const ROW_BUFFER = 4;

export function IconGrid({
  items,
  selectedKey,
  selectedKeys,
  favoriteKeys,
  showLabels,
  fgColor,
  tileMin,
  onSelect,
  onActivate,
  onContext,
  onDragStart,
  onDragEnd,
}: Props) {
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);
  const setScrollRef = useCallback((el: HTMLDivElement | null) => setScrollEl(el), []);
  const setCanvasRef = useCallback((el: HTMLDivElement | null) => setCanvasEl(el), []);
  const [width, setWidth] = useState(0);
  const [viewportH, setViewportH] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  useLayoutEffect(() => {
    if (!scrollEl || !canvasEl) return;
    const update = () => {
      setWidth(canvasEl.clientWidth);
      setViewportH(scrollEl.clientHeight);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(scrollEl);
    ro.observe(canvasEl);
    return () => ro.disconnect();
  }, [scrollEl, canvasEl]);

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

  const lastItemsRef = useRef(items);
  useEffect(() => {
    if (lastItemsRef.current !== items) {
      lastItemsRef.current = items;
      if (scrollEl && scrollEl.scrollTop > 0) {
        scrollEl.scrollTop = 0;
        setScrollTop(0);
      }
    }
  }, [items, scrollEl]);

  useEffect(() => {
    if (!selectedKey || items.length === 0 || cols === 0 || !scrollEl) return;
    const idx = items.findIndex((i) => i.key === selectedKey);
    if (idx < 0) return;
    const row = Math.floor(idx / cols);
    const top = row * rowHeight;
    const bottom = top + tileSize;
    if (top < scrollEl.scrollTop) {
      scrollEl.scrollTop = top;
    } else if (bottom > scrollEl.scrollTop + scrollEl.clientHeight) {
      scrollEl.scrollTop = bottom - scrollEl.clientHeight;
    }
  }, [selectedKey, cols, rowHeight, tileSize, items, scrollEl]);

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
            isMulti={selectedKeys.has(ic.key)}
            isFav={favoriteKeys.has(ic.key)}
            showLabel={showLabels}
            fgColor={fgColor}
            onSelect={onSelect}
            onActivate={onActivate}
            onContext={onContext}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
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
    selectedKeys,
    favoriteKeys,
    showLabels,
    fgColor,
    onSelect,
    onActivate,
    onContext,
    onDragStart,
    onDragEnd,
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
      ref={setScrollRef}
      className="virt-scroll"
      onScroll={(e) => setScrollTop((e.target as HTMLDivElement).scrollTop)}
    >
      <div ref={setCanvasRef} className="virt-canvas" style={{ height: totalHeight }}>
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
  isMulti: boolean;
  isFav: boolean;
  showLabel: boolean;
  fgColor: string;
  onSelect: (key: string, e: React.MouseEvent) => void;
  onActivate: (key: string) => void;
  onContext: (key: string, x: number, y: number) => void;
  onDragStart: (key: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
}

const Tile = memo(function Tile({
  icon,
  top,
  left,
  size,
  isSelected,
  isMulti,
  isFav,
  showLabel,
  fgColor,
  onSelect,
  onActivate,
  onContext,
  onDragStart,
  onDragEnd,
}: TileProps) {
  return (
    <div
      className={
        "tile" +
        (isSelected ? " selected" : "") +
        (isMulti ? " multi-selected" : "") +
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
      draggable
      onClick={(e) => onSelect(icon.key, e)}
      onDoubleClick={(e) => {
        e.preventDefault();
        onActivate(icon.key);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContext(icon.key, e.clientX, e.clientY);
      }}
      onDragStart={(e) => onDragStart(icon.key, e)}
      onDragEnd={onDragEnd}
      title={icon.name + (icon.source ? " · " + icon.source : "")}
    >
      <RenderedIcon icon={icon} size={null} color={fgColor} />
      <span className="tile-fav">
        <Icon name="star" size={11} />
      </span>
      <span className="tile-label">{icon.name}</span>
      {icon.source && <span className="tile-source">{icon.source}</span>}
      {isMulti && <span className="tile-multi-mark">✓</span>}
    </div>
  );
});
