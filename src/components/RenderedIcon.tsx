import { useEffect, useRef } from "react";
import type { IconRecord } from "../types";

interface Props {
  icon: IconRecord;
  size?: number | null;
  color: string;
}

export function RenderedIcon({ icon, size = null, color }: Props) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const host = ref.current;
    if (!host || !icon) return;
    host.innerHTML = icon.content;
    const svg = host.querySelector("svg");
    if (!svg) return;
    svg.removeAttribute("width");
    svg.removeAttribute("height");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    if (!svg.getAttribute("viewBox")) {
      const w = Number(icon.width) || 24;
      const h = Number(icon.height) || 24;
      svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }
    const sizePx = size != null ? `${size}px` : "100%";
    svg.style.width = sizePx;
    svg.style.height = sizePx;
    svg.style.color = color;
    svg.style.display = "block";
    svg.style.margin = "auto";
    svg.querySelectorAll("[fill]").forEach((el) => {
      el.setAttribute("fill", "currentColor");
    });
  }, [icon, size, color]);

  return (
    <span
      ref={ref}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        height: "100%",
        lineHeight: 0,
      }}
    />
  );
}
