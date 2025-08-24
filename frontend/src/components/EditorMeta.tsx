import React from "react";
import type { Process } from "../types";
import { splitCSV } from "../utils";

type Props = { process: Process; onChange: (next: Process) => void; };

export default function EditorMeta({ process, onChange }: Props) {
  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div className="grid grid--meta">
        <label className="field">
          <span className="label">Name</span>
          <input className="input" value={process.name} onChange={(e) => onChange({ ...process, name: e.target.value })} />
        </label>

        <label className="field">
          <span className="label">Goal</span>
          <input className="input" value={process.content.goal}
            onChange={(e) => onChange({ ...process, content: { ...process.content, goal: e.target.value } })} />
        </label>

        <label className="field">
          <span className="label">Trigger</span>
          <input className="input" value={process.content.trigger}
            onChange={(e) => onChange({ ...process, content: { ...process.content, trigger: e.target.value } })} />
        </label>

        <label className="field">
          <span className="label">Metrics (comma separated)</span>
          <input className="input" value={process.content.metrics.join(",")}
            onChange={(e) => onChange({ ...process, content: { ...process.content, metrics: splitCSV(e.target.value) } })} />
        </label>
      </div>
    </div>
  );
}
