import { Content } from "./types";

export const uid = (p = "id") =>
  `${p}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;

export function moveItem<T>(arr: T[], index: number, dir: number) {
  const a = [...arr];
  const j = index + dir;
  if (j < 0 || j >= a.length) return arr;
  [a[index], a[j]] = [a[j], a[index]];
  return a;
}

export function splitCSV(s: string) {
  return (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

// Convert legacy content (arrays of strings) to the new object model
export function normalizeContent(raw: any): Content {
  const goal = raw?.goal ?? "";
  const trigger = raw?.trigger ?? "";
  let lanes: Content["lanes"] = [];
  let steps: Content["steps"] = [];
  let metrics: string[] = [];

  if (Array.isArray(raw?.lanes)) {
    if (typeof raw.lanes[0] === "string") {
      lanes = raw.lanes.map((name: string) => ({ id: uid("lane"), name }));
    } else {
      lanes = raw.lanes.map((l: any) => ({
        id: String(l?.id ?? uid("lane")),
        name: String(l?.name ?? ""),
      }));
    }
  }

  if (Array.isArray(raw?.steps)) {
    if (typeof raw.steps[0] === "string") {
      const defaultLaneId = lanes[0]?.id ?? null;
      steps = raw.steps.map((label: string) => ({
        id: uid("step"),
        label,
        laneId: defaultLaneId,
      }));
    } else {
      steps = raw.steps.map((s: any) => ({
        id: String(s?.id ?? uid("step")),
        label: String(s?.label ?? ""),
        laneId: s?.laneId ? String(s.laneId) : null,
        pos: s?.pos ? { x: Number(s.pos.x) || 0, y: Number(s.pos.y) || 0 } : undefined,
      }));
    }
  }

  if (Array.isArray(raw?.metrics)) {
    metrics = typeof raw.metrics[0] === "string" ? raw.metrics : raw.metrics.map((m: any) => String(m));
  }

  return { goal, trigger, lanes, steps, metrics };
}
