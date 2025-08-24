import React, { useState } from "react";
import type { Lane, ProcStep } from "../types";

type Props = {
  steps: ProcStep[];
  lanes: Lane[];
  onAdd: () => void;
  onRename: (id: string, label: string) => void;
  onReassign: (id: string, laneId: string | null) => void;
  onDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void; // NEW
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
  function onDragEnd() {
    setDragging(null);
  }

  return (
    <section className="section">
      <h2 className="section__title">
        Steps
        <button type="button" className="btn btn--secondary" onClick={onAdd}>➕ Add step</button>
      </h2>

      {steps.length === 0 && <p className="empty">Aucun step. Clique “Add step”.</p>}

      <ul className="list">
        {steps.map((s, idx) => (
          <li
            key={s.id}
            className={`list__item drag-row ${dragging === idx ? "dragging" : ""}`}
            style={{ gridTemplateColumns: "28px 1fr 220px auto", display: "grid" }}
            onDragOver={onDragOver}
            onDrop={(e) => onDrop(e, idx)}
          >
            <button
              className="drag-handle"
              title="Drag to reorder"
              draggable
              onDragStart={(e) => onDragStart(e, idx)}
              onDragEnd={onDragEnd}
            >⋮⋮</button>

            <input
              className="input"
              value={s.label}
              onChange={(e) => onRename(s.id, e.target.value)}
              placeholder="Step label"
            />

            <select
              className="select"
              value={s.laneId ?? ""}
              onChange={(e) => onReassign(s.id, e.target.value || null)}
            >
              <option value="">(No lane)</option>
              {lanes.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>

            <button type="button" className="btn btn--danger" onClick={() => onDelete(s.id)}>
              🗑
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
