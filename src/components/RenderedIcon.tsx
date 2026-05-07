import { memo } from "react";
import type { IconRecord } from "../types";

interface Props {
  icon: IconRecord;
  size?: number | null;
  color: string;
}

/**
 * SVG content is pre-normalized at import time (see preprocessSvgContent),
 * so we just inject it once via innerHTML and let `style.color` propagate
 * through `currentColor`. No per-render attribute mutation.
 */
function RenderedIconImpl({ icon, size = null, color }: Props) {
  const dim = size != null ? `${size}px` : "100%";
  return (
    <span
      className="icon-render"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: dim,
        height: dim,
        lineHeight: 0,
        color,
      }}
      // content is sanitized at import time and trusted by design
      dangerouslySetInnerHTML={{ __html: icon.content }}
    />
  );
}

export const RenderedIcon = memo(RenderedIconImpl, (prev, next) => {
  return (
    prev.icon.key === next.icon.key &&
    prev.color === next.color &&
    prev.size === next.size
  );
});
