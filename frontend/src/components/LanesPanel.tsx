import React, { useState } from "react";
import type { Lane } from "../types";

type Props = {
  lanes: Lane[];
  onAdd: () => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void; // NEW
};

export default function LanesPanel({ lanes, onAdd, onRename, onDelete, onReorder }: Props) {
  const [dragging, setDragging] = useState<number | null>(null);

  function onDragStart(e: React.DragEvent<HTMLButtonElement>, index: number) {
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
    setDragging(index);
  }
  function onDragOver(e: React.DragEvent<HTMLLIElement>) {
    e.preventDefault(); // allow drop
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
        Lanes
        <button type="button" className="btn btn--secondary" onClick={onAdd}>➕ Add lane</button>
      </h2>

      {lanes.length === 0 && <p className="empty">Aucune lane. Clique “Add lane”.</p>}

      <ul className="list">
        {lanes.map((l, idx) => (
          <li
            key={l.id}
            className={`list__item drag-row ${dragging === idx ? "dragging" : ""}`}
            style={{ gridTemplateColumns: "28px 1fr auto" }}
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
              value={l.name}
              onChange={(e) => onRename(l.id, e.target.value)}
            />

            <button type="button" className="btn btn--danger" onClick={() => onDelete(l.id)}>
              🗑
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
