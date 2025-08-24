import React, { useMemo, useRef, useState } from "react";
import type { Process } from "../types";

type BaseProps = {
  list: Process[];
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onNew: () => void;
  onExportCurrent: () => void;
  onImportFile: (file: File) => void;
};

type OverlayProps = BaseProps & {
  pinned?: false;
  open: boolean;
  onClose: () => void;
};

type PinnedProps = BaseProps & {
  pinned: true;
};

export default function ProcessSidebar(props: OverlayProps | PinnedProps) {
  const [q, setQ] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return props.list;
    return props.list.filter((p) => (p.name || "").toLowerCase().includes(t) || String(p.id || "").includes(t));
  }, [q, props.list]);

  function triggerImport() {
    fileRef.current?.click();
  }
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) (props as BaseProps).onImportFile(f);
    e.currentTarget.value = "";
  }

  /* ---------- PINNED (desktop) ---------- */
  if ("pinned" in props && props.pinned) {
    const { onNew, onSelect, onDelete, onExportCurrent } = props;
    return (
      <aside className="sidebar-panel">
        <div className="sidebar-panel__header">
          <strong>Processes</strong>
          <button className="btn btn--ghost" onClick={onNew}>＋ New</button>
        </div>

        <div className="sidebar-panel__search">
          <input
            className="input"
            placeholder="Search by name or #id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <ul className="sidebar-panel__list">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="sidebar-panel__item"
              onClick={() => p.id && onSelect(p.id)}
            >
              <div className="sidebar-panel__meta">
                <div className="sidebar-panel__title">{p.name || "Untitled"}</div>
                <div className="sidebar-panel__sub">
                  <code>#{p.id}</code> • {p.updated_at ? new Date(p.updated_at).toLocaleString() : "—"}
                </div>
              </div>
              <button
                className="btn btn--link btn--link-danger"
                onClick={(e) => { e.stopPropagation(); p.id && onDelete(p.id); }}
              >
                Delete
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="empty" style={{ padding: 8 }}>No process</li>}
        </ul>

        <div className="sidebar-panel__footer">
          <button className="btn btn--ghost" onClick={onExportCurrent}>⬇️ Export</button>
          <button className="btn btn--ghost" onClick={triggerImport}>⬆️ Import</button>
          <input ref={fileRef} type="file" hidden accept=".json,application/json" onChange={handleFile} />
        </div>
      </aside>
    );
  }

  /* ---------- OVERLAY (mobile) ---------- */
  const { open, onClose, onNew, onSelect, onDelete, onExportCurrent } = props as OverlayProps;
  return (
    <>
      <div className={`sidebar ${open ? "sidebar--open" : ""}`}>
        <div className="sidebar__header">
          <strong>Processes</strong>
          <button className="btn btn--ghost" onClick={onNew}>＋ New</button>
        </div>

        <div className="sidebar__search">
          <input
            className="input"
            placeholder="Search by name or #id"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <ul className="sidebar__list">
          {filtered.map((p) => (
            <li key={p.id} className="sidebar__item">
              <div className="sidebar__meta" onClick={() => p.id && (onSelect(p.id), onClose())}>
                <div className="sidebar__title"><strong>{p.name || "Untitled"}</strong></div>
                <div className="sidebar__sub">
                  <code>#{p.id}</code> • {p.updated_at ? new Date(p.updated_at).toLocaleString() : "—"}
                </div>
              </div>
              <button className="btn btn--link btn--link-danger" onClick={() => p.id && onDelete(p.id)}>Delete</button>
            </li>
          ))}
          {filtered.length === 0 && <li className="empty" style={{ padding: 8 }}>No process</li>}
        </ul>

        <div className="sidebar__footer">
          <button className="btn btn--ghost" onClick={onExportCurrent}>⬇️ Export</button>
          <button className="btn btn--ghost" onClick={triggerImport}>⬆️ Import</button>
          <input ref={fileRef} type="file" hidden accept=".json,application/json" onChange={handleFile} />
        </div>
      </div>

      <div className={`sidebar-backdrop ${open ? "is-open" : ""}`} onClick={onClose} />
    </>
  );
}
