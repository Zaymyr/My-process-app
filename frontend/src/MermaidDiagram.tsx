import React, { useEffect, useMemo, useRef, useState } from "react";
import mermaid from "mermaid";

type Lane = { id: string; name: string };
type ProcStep = { id: string; label: string; laneId: string | null };
type Content = { goal: string; trigger: string; lanes: Lane[]; steps: ProcStep[]; metrics: string[] };

/* ---------- Theming ---------- */
function cssVar(name: string, fallback: string) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}
function configureMermaid() {
  const surface = cssVar("--surface", "#ffffff");
  const panel   = cssVar("--panel",   "#f3f4f6");
  const border  = cssVar("--border",  "#e5e7eb");
  const text    = cssVar("--text",    "#0f172a");
  const muted   = cssVar("--muted",   "#64748b");

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "loose",
    theme: "base",
    themeVariables: {
      primaryColor: surface,
      primaryBorderColor: border,
      primaryTextColor: text,
      lineColor: muted,
      tertiaryColor: surface,
      fontFamily:
        'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial',
    },
    flowchart: {
      diagramPadding: 8,
      padding: 8,
      nodeSpacing: 45,
      rankSpacing: 70,
      curve: "basis",
      htmlLabels: true,
      defaultRenderer: "dagre-wrapper",
      useMaxWidth: false, // ⬅️ important: we control size via CSS/viewBox
    },
    themeCSS: `
      .label, .edgeLabel { color: ${text}; font-weight: 600; }
      svg { width: 100% !important; height: 100% !important; max-width: none !important; }
      .node.step rect, .node.step polygon, .node.step path {
        fill: ${surface};
        stroke: ${border};
        stroke-width: 1.2px;
        rx: 12; ry: 12;
        filter: drop-shadow(0 6px 16px rgba(2,6,23,.10)) drop-shadow(0 1px 3px rgba(2,6,23,.08));
      }
      .node.step .label > * { font-weight: 700; }
      .cluster rect { fill: ${panel}; stroke: ${border}; rx: 14; ry: 14; }
      .cluster .cluster-label > * { fill: transparent; font-weight: 800; }
      .edgePath path { stroke: ${muted}; stroke-width: 2.2px; }
      .arrowheadPath { fill: ${muted}; }
    `,
  });
}

/* ---------- Build Mermaid code ---------- */
function sanitizeId(s: string, prefix = "id"): string {
  const core = (s || "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+/, "");
  const safe = core.length ? core : prefix;
  return /^[a-z_]/.test(safe) ? safe : `${prefix}_${safe}`;
}
function escapeLabel(s: string): string {
  return (s ?? "").replace(/\\/g, "\\\\").replace(/\[/g, "(").replace(/\]/g, ")").replace(/"/g, "'");
}
function buildMermaid(content: Content): string {
  const lines: string[] = [];
  lines.push("flowchart LR");

  const laneMap = new Map<string, { id: string; label: string; nodes: string[] }>();
  for (const l of content.lanes) {
    const laneId = sanitizeId(l.id || l.name || "lane", "lane");
    laneMap.set(l.id, { id: laneId, label: l.name || "Lane", nodes: [] });
  }
  const UNASSIGNED = "__NO_LANE__";
  if (content.steps.some((s) => !s.laneId)) {
    laneMap.set(UNASSIGNED, { id: "lane_unassigned", label: "(No lane)", nodes: [] });
  }

  const order: string[] = [];
  for (const s of content.steps) {
    const nodeId = sanitizeId(s.id || s.label || "step", "step");
    const label = escapeLabel(s.label || "Step");
    lines.push(`${nodeId}["${label}"]:::step`);
    order.push(nodeId);
    const key = s.laneId ?? UNASSIGNED;
    const bucket = laneMap.get(key);
    if (bucket) bucket.nodes.push(nodeId);
  }

  for (const [, lane] of laneMap) {
    const title = escapeLabel(lane.label || "Lane");
    lines.push(`subgraph ${lane.id}["${title}"]`);
    lines.push("direction TB");
    if (lane.nodes.length === 0) {
      const ghostId = sanitizeId(`${lane.id}_ghost`, "n");
      lines.push(`${ghostId}[" "]`);
      lines.push(`style ${ghostId} fill:#0000,stroke:#0000,color:#0000`);
    } else {
      for (const n of lane.nodes) lines.push(n);
    }
    lines.push("end");
  }

  if (order.length > 1) {
    lines.push("%% Edges (global order)");
    for (let i = 0; i < order.length - 1; i++) lines.push(`${order[i]} --> ${order[i + 1]}`);
  }
  return lines.join("\n");
}

/* ---------- Pan & Zoom via SVG viewBox (clamped) ---------- */
type VB = { x: number; y: number; w: number; h: number };
const MIN_Z = 0.25;
const MAX_Z = 3.5;
const Z_STEP = 1.2;

function readViewBox(svg: SVGSVGElement): VB {
  const [x, y, w, h] = (svg.getAttribute("viewBox") || "0 0 100 100")
    .split(/\s+/)
    .map(Number);
  return { x, y, w, h };
}
function writeViewBox(svg: SVGSVGElement, vb: VB) {
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
}
function prepareSvg(svg: SVGSVGElement) {
  let vbAttr = svg.getAttribute("viewBox");
  if (!vbAttr) {
    const w = Number(svg.getAttribute("width"))  || svg.getBBox().width  || 100;
    const h = Number(svg.getAttribute("height")) || svg.getBBox().height || 100;
    svg.setAttribute("viewBox", `0 0 ${Math.max(1,w)} ${Math.max(1,h)}`);
  }
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
}
/** Union bounds of all drawn shapes (robust). */
function contentBounds(svg: SVGSVGElement, pad = 48): VB {
  const selectors = [
    "g.node", "g.cluster",
    "g.edgePath", "g.edgePaths path", "path.edgePath", "polygon.arrowheadPath",
    "foreignObject", "text", "tspan",
    "rect", "ellipse", "polygon", "path"
  ].join(",");
  const els = svg.querySelectorAll<SVGGraphicsElement>(selectors);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  els.forEach(el => {
    try {
      const b = el.getBBox();
      if (!b || !isFinite(b.width) || !isFinite(b.height)) return;
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    } catch {}
  });

  if (!isFinite(minX)) {
    const vb = readViewBox(svg);
    return { x: vb.x - pad, y: vb.y - pad, w: vb.w + pad * 2, h: vb.h + pad * 2 };
  }

  const w = Math.max(1, maxX - minX);
  const h = Math.max(1, maxY - minY);
  return { x: minX - pad, y: minY - pad, w: w + pad * 2, h: h + pad * 2 };
}
function scaleForViewport(rect: DOMRect, vb: VB) {
  return Math.min(rect.width / vb.w, rect.height / vb.h);
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
/** Bi-directional clamp with optional breathing room. */
function clampToBase(vb: VB, base: VB, pad = 12): VB {
  let x = vb.x, y = vb.y;
  if (vb.w <= base.w) {
    const minX = base.x + pad, maxX = base.x + base.w - vb.w - pad;
    x = clamp(x, minX, maxX);
  } else {
    const slack = vb.w - base.w;
    const minX = base.x - slack + pad, maxX = base.x - pad;
    x = clamp(x, minX, maxX);
  }
  if (vb.h <= base.h) {
    const minY = base.y + pad, maxY = base.y + base.h - vb.h - pad;
    y = clamp(y, minY, maxY);
  } else {
    const slack = vb.h - base.h;
    const minY = base.y - slack + pad, maxY = base.y - pad;
    y = clamp(y, minY, maxY);
  }
  return { x, y, w: vb.w, h: vb.h };
}

export default function MermaidDiagram({ content }: { content: Content }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const holderRef   = useRef<HTMLDivElement | null>(null);
  const svgRef      = useRef<SVGSVGElement | null>(null);

  const baseRef = useRef<VB | null>(null);
  const vbRef   = useRef<VB | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [raw, setRaw] = useState<string>("");

  const code = useMemo(() => buildMermaid(content), [content]);

  useEffect(() => {
    configureMermaid();
    let cancelled = false;
    setErr(null);
    setRaw(code);

    (async () => {
      try {
        const { svg } = await mermaid.render("mmd_" + Math.random().toString(36).slice(2), code);
        if (cancelled) return;

        if (holderRef.current) {
          holderRef.current.innerHTML = svg;
          const svgEl = holderRef.current.querySelector("svg") as SVGSVGElement | null;
          svgRef.current = svgEl || null;

          if (svgRef.current) {
            prepareSvg(svgRef.current);
            const base = contentBounds(svgRef.current, 48);
            baseRef.current = { ...base };
            vbRef.current   = { ...base };
            writeViewBox(svgRef.current, base);
            fit(); // start fitted with slack
          }
        }
      } catch (e: any) {
        if (!cancelled) {
          setErr(e?.message || "Mermaid render failed");
          if (holderRef.current) holderRef.current.innerHTML = "";
        }
      }
    })();

    return () => { cancelled = true; };
  }, [code]);

  // Wheel zoom (cursor-centered)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const onWheel = (e: WheelEvent) => {
      if (!svgRef.current || !baseRef.current || !vbRef.current) return;
      if (!e.ctrlKey) e.preventDefault();
      const rect = vp.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const factor = Math.exp(-e.deltaY * 0.001);
      zoomAt(cx, cy, factor);
    };

    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, []);

  // Drag to pan (clamped)
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    let dragging = false;
    let sx = 0, sy = 0;
    let vb0: VB | null = null;

    const onDown = (e: PointerEvent) => {
      if (!vbRef.current) return;
      if (e.button !== 0) return;
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      vb0 = { ...vbRef.current };
      (e.target as Element).setPointerCapture?.(e.pointerId);
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging || !vb0 || !vbRef.current || !svgRef.current || !baseRef.current || !viewportRef.current) return;
      const rect = viewportRef.current.getBoundingClientRect();
      const s = scaleForViewport(rect, vb0);
      const dx = (e.clientX - sx) / s;
      const dy = (e.clientY - sy) / s;
      const next = clampToBase({ ...vb0, x: vb0.x - dx, y: vb0.y - dy }, baseRef.current);
      vbRef.current = next;
      writeViewBox(svgRef.current, next);
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    };

    vp.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      vp.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  // Keyboard & Resize
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!svgRef.current) return;
      if (["+", "=", "-", "_", "0"].includes(e.key)) {
        e.preventDefault();
        if (e.key === "0") fit();
        else if (e.key === "+" || e.key === "=") centerZoom(Z_STEP);
        else if (e.key === "-" || e.key === "_") centerZoom(1 / Z_STEP);
      }
    };
    const onResize = () => fit();
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  function centerZoom(factor: number) {
    const vp = viewportRef.current;
    if (!vp) return;
    const r = vp.getBoundingClientRect();
    zoomAt(r.width / 2, r.height / 2, factor);
  }

  function zoomAt(cx: number, cy: number, factor: number) {
    if (!svgRef.current || !baseRef.current || !vbRef.current || !viewportRef.current) return;

    const base = baseRef.current;
    const vb   = vbRef.current;
    const rect = viewportRef.current.getBoundingClientRect();

    const s  = scaleForViewport(rect, vb);
    const ox = (rect.width  - s * vb.w) / 2;
    const oy = (rect.height - s * vb.h) / 2;

    const wx = vb.x + (cx - ox) / s;
    const wy = vb.y + (cy - oy) / s;

    const currentK = base.w / vb.w;
    const kNew = clamp(currentK * factor, MIN_Z, MAX_Z);
    const wNew = base.w / kNew;
    const hNew = base.h / kNew;

    const sNew  = scaleForViewport(rect, { x: vb.x, y: vb.y, w: wNew, h: hNew });
    const oxNew = (rect.width  - sNew * wNew) / 2;
    const oyNew = (rect.height - sNew * hNew) / 2;
    const xNew = wx - (cx - oxNew) / sNew;
    const yNew = wy - (cy - oyNew) / sNew;

    const unclamped = { x: xNew, y: yNew, w: wNew, h: hNew };
    const next = clampToBase(unclamped, base);
    vbRef.current = next;
    writeViewBox(svgRef.current, next);
  }

  /** Fit with slack so you can pan even when zoomed out. */
  function fit(slack = 0.08) {
    if (!svgRef.current || !baseRef.current || !viewportRef.current) return;
    const base = baseRef.current;
    const rect = viewportRef.current.getBoundingClientRect();

    const baseAspect = base.w / base.h;
    const vpAspect   = rect.width / rect.height;

    let w = base.w, h = base.h;
    if (vpAspect > baseAspect) w = base.h * vpAspect; else h = base.w / vpAspect;

    // add slack both directions
    w = Math.max(w, base.w + base.w * slack);
    h = Math.max(h, base.h + base.h * slack);

    const x = base.x - (w - base.w) / 2;
    const y = base.y - (h - base.h) / 2;

    const next = { x, y, w, h };
    vbRef.current = next;
    writeViewBox(svgRef.current, next);
  }

  return (
    <div>
      <div className="zoom-viewport" ref={viewportRef} tabIndex={0} aria-label="Diagram viewport (pan & zoom)">
        <div className="zoom-controls" aria-hidden="true">
          <button className="zbtn" onClick={() => centerZoom(1 / Z_STEP)} title="Zoom out (−)">−</button>
          <button className="zbtn" onClick={() => centerZoom(Z_STEP)}      title="Zoom in (+)">+</button>
          <button className="zbtn" onClick={() => fit()}                   title="Fit (0)">⤢</button>
        </div>
        <div className="zoom-stage" ref={holderRef} />
      </div>

      {err && (
        <div style={{ marginTop: 12 }}>
          <div className="status status--error">Mermaid: {err}</div>
          <details style={{ marginTop: 8 }}>
            <summary>Show diagram source</summary>
            <pre style={{ whiteSpace: "pre-wrap" }}>{raw}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
