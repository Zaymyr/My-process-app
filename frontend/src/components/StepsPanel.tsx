import React, { useState } from "react";
import type { Lane, ProcStep } from "../types";

type Props = {
  steps: ProcStep[];
  lanes: Lane[];
  onAdd: () => void;
  onRename: (id: string, label: string) => void;
  onReassign: (id: string, laneId: string | null) => void;
  onDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
};

export default function StepsPanel({ steps, lanes, onAdd, onRename, onReassign, onDelete, onReorder }: Props) {
  const [dragging, setDragging] = useState<number | null>(null);

  function onDragStart(e: React.DragEvent<HTMLButtonElement>, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    setDragging(index);
  }
  function onDragOver(e: React.DragEvent<HTMLLIElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function onDrop(e: React.DragEvent<HTMLLIElement>, toIndex: number) {
    const fromIndex = Number(e.dataTransfer.getData("text/plain"));
    setDragging(null);
    if (!Number.isFinite(fromIndex) || fromIndex === toIndex) return;
    onReorder(fromIndex, toIndex);
  }
  function onDragEnd() { setDragging(null); }

  return (
    <section className="section steps-panel">
      <h2 className="section__title">
        Steps
        <button type="button" className="btn btn--secondary" onClick={onAdd}>➕ Add step</button>
      </h2>

      {steps.length === 0 && <p className="empty">Aucun step. Clique “Add step”.</p>}

      <ul className="list">
        {steps.map((s, idx) => (
          <li
            key={s.id}
            className={`list__item step-row ${dragging === idx ? "dragging" : ""}`}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, idx)}
          >
            <button
              className="drag-handle"
              title="Drag to reorder"
              draggable
              onDragStart={(e) => onDragStart(e, idx)}
              onDragEnd={onDragEnd}
              aria-label="Reorder step"
            >⋮⋮</button>

            {/* Put lane first so it keeps a fixed, readable width */}
            <select
              className="select lane-select"
              value={s.laneId ?? ""}
              onChange={(e) => onReassign(s.id, e.target.value || null)}
            >
              <option value="">(No lane)</option>
              {lanes.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>

            <input
              className="input step-input"
              value={s.label}
              onChange={(e) => onRename(s.id, e.target.value)}
              placeholder="Step name"
            />

            <button type="button" className="btn btn--danger" onClick={() => onDelete(s.id)}>
              🗑
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
