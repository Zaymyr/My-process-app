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
      useMaxWidth: false, // we control size via CSS/viewBox
    },
    themeCSS: `
      .label, .edgeLabel { color: ${text}; font-weight: 600; }
      svg { width: 100% !important; height: 100% !important; max-width: none !important; }

      /* Regular step cards */
      .node.step rect, .node.step polygon, .node.step path {
        fill: ${surface};
        stroke: ${border};
        stroke-width: 1.2px;
        rx: 12; ry: 12;
        filter: drop-shadow(0 6px 16px rgba(2,6,23,.10)) drop-shadow(0 1px 3px rgba(2,6,23,.08));
      }
      .node.step .label > * { font-weight: 700; }

      /* Lanes (clusters) */
      .cluster rect { fill: ${panel}; stroke: ${border}; rx: 14; ry: 14; }
      .cluster .cluster-label > * { fill: transparent; font-weight: 800; }

      /* Edges */
      .edgePath path { stroke: ${muted}; stroke-width: 2.2px; }
      .arrowheadPath { fill: ${muted}; }

      /* Trigger (blue) & Goal (green) */
      .node.trigger circle { fill: #e0f2fe; stroke: #60a5fa; }
      .node.goal    circle { fill: #dcfce7; stroke: #34d399; }
      .node.trigger .label > *, .node.goal .label > * { font-weight: 800; }
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
function buildMermaid(content: Content, mode: "horizontal" | "vertical"): string {
  const H = mode === "horizontal";
  const lines: string[] = [];

  lines.push(H ? "flowchart LR" : "flowchart TB");

  const hasTrigger = !!content.trigger?.trim();
  const hasGoal    = !!content.goal?.trim();
  if (hasTrigger) lines.push(`trig(("${escapeLabel(content.trigger!)}")):::trigger`);
  if (hasGoal)    lines.push(`goal(("${escapeLabel(content.goal!)}")):::goal`);

  const UNASSIGNED = "__NO_LANE__";
  type Row = { key: string; id: string; label: string };
  const rows: Row[] = [];

  for (const l of content.lanes) {
    const id = sanitizeId(l.id || l.name || "lane", "lane");
    rows.push({ key: l.id, id, label: l.name || "Lane" });
  }
  if (content.steps.some((s) => !s.laneId)) {
    rows.push({ key: UNASSIGNED, id: "lane_unassigned", label: "(No lane)" });
  }
  if (rows.length === 0) rows.push({ key: "_default", id: "lane_default", label: "Lane" });

  const ordered: string[] = [];
  const byLane = new Map<string, string[]>();
  for (const r of rows) byLane.set(r.key, []);
  for (const s of content.steps) {
    const id = sanitizeId(s.id || s.label || "step", "step");
    lines.push(`${id}["${escapeLabel(s.label || "Step")}"]:::step`);
    ordered.push(id);
    const k = s.laneId ?? UNASSIGNED;
    (byLane.get(k) ?? byLane.get("_default")!)!.push(id);
  }

  lines.push(`subgraph STACK[" "]`);
  lines.push(H ? `direction TB` : `direction LR`);

  for (const r of rows) {
    lines.push(`subgraph ${r.id}["${escapeLabel(r.label)}"]`);
    lines.push(H ? `direction LR` : `direction TB`);
    const nodes = byLane.get(r.key)!;
    if (nodes.length === 0) {
      const ghost = `${r.id}_ghost`;
      lines.push(`${ghost}[" "]`);
      lines.push(`style ${ghost} fill:#0000,stroke:#0000,color:#0000`);
    } else {
      for (const n of nodes) lines.push(n);
    }
    lines.push("end");
  }
  lines.push("end");
  lines.push(`style STACK fill:#0000,stroke:#0000,color:#0000`);

  const first = ordered[0];
  const last  = ordered[ordered.length - 1];
  if (hasTrigger && first) lines.push(`trig --> ${first}`);
  for (let i = 0; i < ordered.length - 1; i++) lines.push(`${ordered[i]} --> ${ordered[i + 1]}`);
  if (hasGoal && last) lines.push(`${last} --> goal`);

  return lines.join("\n");
}

/* ---------- Pan & Zoom via SVG viewBox (clamped) ---------- */
type VB = { x: number; y: number; w: number; h: number };
const MIN_Z = 0.15;
const MAX_Z = 6
const Z_STEP = 1.2;


function readViewBox(svg: SVGSVGElement): VB {
  const [x, y, w, h] = (svg.getAttribute("viewBox") || "0 0 100 100").split(/\s+/).map(Number);
  return { x, y, w, h };
}
function writeViewBox(svg: SVGSVGElement, vb: VB) {
  svg.setAttribute("viewBox", `${vb.x} ${vb.y} ${vb.w} ${vb.h}`);
}
function prepareSvg(svg: SVGSVGElement) {
  if (!svg.getAttribute("viewBox")) {
    const w = Number(svg.getAttribute("width")) || svg.getBBox().width || 100;
    const h = Number(svg.getAttribute("height")) || svg.getBBox().height || 100;
    svg.setAttribute("viewBox", `0 0 ${Math.max(1, w)} ${Math.max(1, h)}`);
  }
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
}
/** Union bounds of all drawn shapes (robust). */
function contentBounds(svg: SVGSVGElement, pad = 48): VB {
  const selectors = [
    "g.node","g.cluster","g.edgePath","g.edgePaths path","path.edgePath","polygon.arrowheadPath",
    "foreignObject","text","tspan","rect","ellipse","polygon","path"
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
function scaleForViewport(rect: DOMRect, vb: VB) { return Math.min(rect.width / vb.w, rect.height / vb.h); }
function clamp(n: number, a: number, b: number) { return Math.max(a, Math.min(b, n)); }
/** Bi-directional clamp with optional breathing room. */
function clampToBase(vb: VB, base: VB, pad = 12): VB {
  let x = vb.x, y = vb.y;
  if (vb.w <= base.w) { x = clamp(x, base.x + pad, base.x + base.w - vb.w - pad); }
  else {
    const slack = vb.w - base.w;
    x = clamp(x, base.x - slack + pad, base.x - pad);
  }
  if (vb.h <= base.h) { y = clamp(y, base.y + pad, base.y + base.h - vb.h - pad); }
  else {
    const slack = vb.h - base.h;
    y = clamp(y, base.y - slack + pad, base.y - pad);
  }
  return { x, y, w: vb.w, h: vb.h };
}

function getCssVar(name: string, fallback: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}
/** Big dotted background that moves/scales with viewBox. */
function ensureSvgDottedBackground(svg: SVGSVGElement, box: VB) {
  const ns = "http://www.w3.org/2000/svg";
  svg.querySelector("#mmd-bg-group")?.remove();
  svg.querySelector("#mmd-pat-dots")?.remove();

  const defs = svg.querySelector("defs") || svg.insertBefore(document.createElementNS(ns, "defs"), svg.firstChild);
  const pat = document.createElementNS(ns, "pattern");
  pat.id = "mmd-pat-dots";
  pat.setAttribute("patternUnits", "userSpaceOnUse");
  pat.setAttribute("width", "20");
  pat.setAttribute("height", "20");
  const dot = document.createElementNS(ns, "circle");
  dot.setAttribute("cx", "1"); dot.setAttribute("cy", "1"); dot.setAttribute("r", "1");
  dot.setAttribute("fill", getCssVar("--dot", "#e9edf5"));
  pat.appendChild(dot);
  defs.appendChild(pat);

  const pad = Math.max(box.w, box.h);
  const x = box.x - pad, y = box.y - pad, w = box.w + pad * 2, h = box.h + pad * 2;

  const group = document.createElementNS(ns, "g");
  group.id = "mmd-bg-group";

  const base = document.createElementNS(ns, "rect");
  base.setAttribute("x", String(x)); base.setAttribute("y", String(y));
  base.setAttribute("width", String(w)); base.setAttribute("height", String(h));
  base.setAttribute("fill", getCssVar("--surface", "#ffffff"));

  const patternRect = document.createElementNS(ns, "rect");
  patternRect.setAttribute("x", String(x)); patternRect.setAttribute("y", String(y));
  patternRect.setAttribute("width", String(w)); patternRect.setAttribute("height", String(h));
  patternRect.setAttribute("fill", "url(#mmd-pat-dots)");

  group.appendChild(base);
  group.appendChild(patternRect);
  svg.insertBefore(group, svg.firstChild);
}

export default function MermaidDiagram({
  content,
  layout = "horizontal",
  onToggleLayout,
}: {
  content: Content;
  layout?: "horizontal" | "vertical";
  onToggleLayout?: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const holderRef   = useRef<HTMLDivElement | null>(null);
  const svgRef      = useRef<SVGSVGElement | null>(null);

  const fitRef = useRef<VB | null>(null);
  const zoomRef = useRef<number>(1);

  const baseRef = useRef<VB | null>(null);
  const vbRef   = useRef<VB | null>(null);

  const [err, setErr] = useState<string | null>(null);
  const [raw, setRaw] = useState<string>("");

  const code = useMemo(() => buildMermaid(content, layout), [content, layout]);
  useEffect(() => {
  const vp = viewportRef.current;
  if (!vp) return;

  const onWheel = (e: WheelEvent) => {
    // Don't let the page scroll or browser zoom
    e.preventDefault();

    // If not ready yet, compute a fitted baseline on the fly
    if (svgRef.current && baseRef.current && viewportRef.current && !fitRef.current) {
      const rect = viewportRef.current.getBoundingClientRect();
      const fitted = computeFitFor(rect, baseRef.current, 0.08);
      fitRef.current = { ...fitted };
      if (!vbRef.current) vbRef.current = { ...fitted };
      writeViewBox(svgRef.current, vbRef.current!);
    }

    // Bail out if still not ready
    if (!svgRef.current || !baseRef.current || !vbRef.current || !fitRef.current || !viewportRef.current) return;

    // Cursor coords in viewport
    const rect = viewportRef.current.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;

    // Smooth zoom factor (negative deltaY = zoom in)
    const factor = Math.exp(-e.deltaY * 0.001);
    zoomAt(cx, cy, factor);
  };

  // Passive must be false to allow preventDefault
  vp.addEventListener("wheel", onWheel, { passive: false });
  return () => vp.removeEventListener("wheel", onWheel);
}, []);

  useEffect(() => {
  configureMermaid();
  let cancelled = false;
  setErr(null);
  setRaw(code);

  // snapshot previous transform before we wipe/rebuild the SVG
  const prevBase = baseRef.current;
  const prevVB   = vbRef.current;
  const prevZoom = zoomRef.current;
  let prevCenterRatios: { rx: number; ry: number } | null = null;

  if (prevBase && prevVB) {
    const cx = prevVB.x + prevVB.w / 2;
    const cy = prevVB.y + prevVB.h / 2;
    prevCenterRatios = {
      rx: (cx - prevBase.x) / prevBase.w,
      ry: (cy - prevBase.y) / prevBase.h,
    };
  }

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

          const newBase = contentBounds(svgRef.current, 48);
          baseRef.current = { ...newBase };
          ensureSvgDottedBackground(svgRef.current, newBase);

          const vp = viewportRef.current;
          const rect = vp?.getBoundingClientRect();
          const newFit = rect ? computeFitFor(rect, newBase, 0.08) : newBase;
          fitRef.current = { ...newFit };

          // If we had a previous transform, reapply it on the new diagram
          if (prevCenterRatios && typeof prevZoom === "number") {
            const z = clamp(prevZoom, MIN_Z, MAX_Z);
            const wNew = newFit.w / z;
            const hNew = newFit.h / z;

            const cxNew = newBase.x + prevCenterRatios.rx * newBase.w;
            const cyNew = newBase.y + prevCenterRatios.ry * newBase.h;

            const desired: VB = { x: cxNew - wNew / 2, y: cyNew - hNew / 2, w: wNew, h: hNew };
            const next = clampToBase(desired, newBase, 12);

            vbRef.current   = next;
            zoomRef.current = z;
            writeViewBox(svgRef.current, next);
          } else {
            // first render: start at fit
            vbRef.current   = { ...newFit };
            zoomRef.current = 1;
            writeViewBox(svgRef.current, newFit);
          }
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
  // Drag to pan (clamped)
useEffect(() => {
  const vp = viewportRef.current;
  if (!vp) return;

  let dragging = false;
  let sx = 0, sy = 0;
  let vb0: VB | null = null;

  const onDown = (e: PointerEvent) => {
    // left mouse, pen, or touch
    const isPrimaryMouse = e.pointerType === "mouse" ? e.button === 0 : true;
    if (!isPrimaryMouse) return;
    if (!vbRef.current || !baseRef.current) return;

    dragging = true;
    sx = e.clientX; sy = e.clientY;
    vb0 = { ...vbRef.current };
    (e.target as Element).setPointerCapture?.(e.pointerId);
    // prevent text selection & native gestures
    e.preventDefault();
    vp.classList.add("is-dragging");
  };

  const onMove = (e: PointerEvent) => {
    if (!dragging || !vb0 || !viewportRef.current || !svgRef.current || !baseRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const scale = scaleForViewport(rect, vb0);
    // move canvas opposite to pointer
    const dx = (e.clientX - sx) / scale;
    const dy = (e.clientY - sy) / scale;
    const next = clampToBase({ ...vb0, x: vb0.x - dx, y: vb0.y - dy }, baseRef.current, 12);
    vbRef.current = next;
    writeViewBox(svgRef.current, next);
  };

  const onUp = (e: PointerEvent) => {
    dragging = false;
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    vp.classList.remove("is-dragging");
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
  
  function computeFitFor(rect: DOMRect, base: VB, slack = 0.08): VB {
  const vpAspect = rect.width / rect.height;
  let w = base.w, h = base.h;
  if (w / h < vpAspect) w = h * vpAspect; else h = w / vpAspect;

  // give some breathing room so you can pan at min zoom
  w = Math.max(w, base.w * (1 + slack));
  h = Math.max(h, base.h * (1 + slack));

  const x = base.x - (w - base.w) / 2;
  const y = base.y - (h - base.h) / 2;
  return { x, y, w, h };
}

  function zoomAt(cx: number, cy: number, factor: number) {
  if (!svgRef.current || !baseRef.current || !vbRef.current || !viewportRef.current || !fitRef.current) return;

  const base = baseRef.current;
  const vb   = vbRef.current;
  const fitV = fitRef.current;
  const rect = viewportRef.current.getBoundingClientRect();

  // Current pixel→world mapping (for the *current* vb)
  const s  = scaleForViewport(rect, vb);
  const ox = (rect.width  - s * vb.w) / 2;
  const oy = (rect.height - s * vb.h) / 2;

  // World coords under cursor before zoom
  const wx = vb.x + (cx - ox) / s;
  const wy = vb.y + (cy - oy) / s;

  // Zoom relative to the *fitted* view (consistent in LR/TB)
  const zNow = zoomRef.current;
  const zNew = clamp(zNow * factor, MIN_Z, MAX_Z);

  // Because fitV already matches viewport aspect, keep that aspect at all zoom levels
  const wNew = fitV.w / zNew;
  const hNew = fitV.h / zNew;

  // Compute new offsets after the size change (keep same world point under cursor)
  const sNew  = scaleForViewport(rect, { x: vb.x, y: vb.y, w: wNew, h: hNew });
  const oxNew = (rect.width  - sNew * wNew) / 2;
  const oyNew = (rect.height - sNew * hNew) / 2;
  const xNew = wx - (cx - oxNew) / sNew;
  const yNew = wy - (cy - oyNew) / sNew;

  // Clamp the viewBox so the content stays in/beside the viewport reasonably
  const unclamped = { x: xNew, y: yNew, w: wNew, h: hNew };
  const next = clampToBase(unclamped, base, 12);

  vbRef.current   = next;
  zoomRef.current = zNew;
  writeViewBox(svgRef.current, next);
}


  /** Fit with slack so you can pan even when zoomed out. */
  function fit(slack = 0.08) {
  if (!svgRef.current || !baseRef.current || !viewportRef.current) return;
  const next = computeFitFor(viewportRef.current.getBoundingClientRect(), baseRef.current, slack);
  fitRef.current  = { ...next };
  vbRef.current   = { ...next };
  zoomRef.current = 1;
  writeViewBox(svgRef.current, next);
}



  // helpers for HUD buttons
  function zoomIn()  { centerZoom(Z_STEP); }
  function zoomOut() { centerZoom(1 / Z_STEP); }
  function reset()   { fit(); }

  return (
    <div>
      <div className="zoom-viewport" ref={viewportRef} tabIndex={0} aria-label="Diagram viewport (pan & zoom)">
        {/* HUD: bottom-right */}
        <div className="hud-br">
          <div className="seg seg--tiny hud-card">
            <button
              className={`seg__btn ${layout === "horizontal" ? "is-active" : ""}`}
              onClick={() => onToggleLayout?.()}
              title="Left → Right"
            >Horizontal</button>
            <button
              className={`seg__btn ${layout === "vertical" ? "is-active" : ""}`}
              onClick={() => onToggleLayout?.()}
              title="Top ↓ Bottom"
            >Vertical</button>
          </div>

          <div className="zoom-controls hud-card" aria-hidden="true">
            <button className="zbtn" onClick={zoomOut} title="Zoom out (−)">−</button>
            <button className="zbtn" onClick={zoomIn}  title="Zoom in (+)">+</button>
            <button className="zbtn" onClick={reset}   title="Fit / Center (0)">⤢</button>
          </div>
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
