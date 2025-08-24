// Editor.tsx
import React, { useCallback, useEffect, useState } from "react";
import { normalizeContent, uid } from "./utils";
import type { Lane, Process, ProcStep } from "./types";
import {
  listProcesses, getProcess, createProcess, updateProcess, deleteProcess,
} from "./services/processService";
import EditorMeta from "./components/EditorMeta";
import LanesPanel from "./components/LanesPanel";
import StepsPanel from "./components/StepsPanel";
import MermaidDiagram from "./MermaidDiagram";
import ProcessSidebar from "./components/ProcessSidebar";
import { me, logout } from "./services/authService";
import AuthPanel from "./components/AuthPanel";

const emptyProcess: Process = {
  name: "",
  content: { goal: "", trigger: "", lanes: [], steps: [], metrics: [] },
};

export default function Editor() {
  // AUTH
  const [user, setUser] = useState<any | null>(null);
  const [checking, setChecking] = useState(true);

  // DATA
  const [process, setProcess] = useState<Process>(emptyProcess);
  const [list, setList] = useState<Process[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // UI
  const [layout, setLayout] = useState<"horizontal" | "vertical">(
    () => (localStorage.getItem("layoutMode") as any) || "horizontal"
  );
  const [leftOpen, setLeftOpen]   = useState(true);   // processes panel
  const [rightOpen, setRightOpen] = useState(true);   // editor panel

  const toggleLayout = () =>
    setLayout(p => {
      const n = p === "horizontal" ? "vertical" : "horizontal";
      localStorage.setItem("layoutMode", n);
      return n;
    });

  const refreshList = useCallback(async () => {
    try { setList(await listProcesses()); }
    catch (e: any) { if (e?.response?.status !== 401) setError(e?.message || "Failed to load list"); }
  }, []);

  useEffect(() => {
    (async () => {
      const u = await me(); setUser(u);
      if (u) await refreshList();
      setChecking(false);
    })();
  }, [refreshList]);

  const resetStatusSoon = () => setTimeout(() => setStatus(""), 1200);

  // CRUD
  async function save(){
    setSaving(true); setStatus(""); setError("");
    try {
      if (!process.id) { await createProcess(process); setStatus("Created ✔"); }
      else            { await updateProcess(process); setStatus("Saved ✔"); }
      await refreshList(); setProcess(emptyProcess);
    } catch (e:any) { setError(e?.response?.data?.error || e?.message || "Save failed"); }
    finally { setSaving(false); resetStatusSoon(); }
  }
  async function loadOne(id:number){
    setStatus("Loading…"); setError("");
    try {
      const p = await getProcess(id);
      p.content = normalizeContent(p.content);
      setProcess(p); setStatus("Loaded ✔");
    } catch (e:any) { setError(e?.message || "Load failed"); }
    finally { resetStatusSoon(); }
  }
  async function remove(id:number){
    if (!confirm("Supprimer ce process ?")) return;
    setStatus("Deleting…"); setError("");
    try {
      await deleteProcess(id);
      if (process.id === id) setProcess(emptyProcess);
      await refreshList(); setStatus("Deleted ✔");
    } catch (e:any) { setError(e?.message || "Delete failed"); }
    finally { resetStatusSoon(); }
  }
  function newProcess(){
    setProcess(prev => ({ ...emptyProcess, content: { ...emptyProcess.content, lanes: prev.content.lanes } }));
  }

  // Lanes
  function addLane(){ const lane: Lane = { id: uid("lane"), name: "New lane" };
    setProcess(prev => ({ ...prev, content: { ...prev.content, lanes: [...prev.content.lanes, lane] } })); }
  function renameLane(id:string, name:string){
    setProcess(prev => ({ ...prev, content: { ...prev.content, lanes: prev.content.lanes.map(l => l.id===id?{...l,name}:l) } })); }
  function deleteLane(id:string){
    setProcess(prev => ({ ...prev, content: {
      ...prev.content,
      lanes: prev.content.lanes.filter(l => l.id!==id),
      steps: prev.content.steps.map(s => s.laneId===id?{...s,laneId:null}:s)
    }})); }
  function reorderLanes(from:number, to:number){
    if (from===to) return;
    setProcess(prev => {
      const a = [...prev.content.lanes]; const [m] = a.splice(from,1); a.splice(to,0,m);
      return { ...prev, content: { ...prev.content, lanes: a } };
    });
  }

  // Steps
  function addStep(){
    const defaultLaneId = process.content.lanes[0]?.id ?? null;
    const step: ProcStep = { id: uid("step"), label: "New step", laneId: defaultLaneId };
    setProcess(prev => ({ ...prev, content: { ...prev.content, steps: [...prev.content.steps, step] } }));
  }
  function renameStep(id:string, label:string){
    setProcess(prev => ({ ...prev, content: { ...prev.content, steps: prev.content.steps.map(s => s.id===id?{...s,label}:s) } })); }
  function reassignStepLane(id:string, laneId:string|null){
    setProcess(prev => ({ ...prev, content: { ...prev.content, steps: prev.content.steps.map(s => s.id===id?{...s,laneId}:s) } })); }
  function deleteStep(id:string){
    setProcess(prev => ({ ...prev, content: { ...prev.content, steps: prev.content.steps.filter(s => s.id!==id) } })); }
  function reorderSteps(from:number, to:number){
    if (from===to) return;
    setProcess(prev => {
      const a = [...prev.content.steps]; const [m] = a.splice(from,1); a.splice(to,0,m);
      return { ...prev, content: { ...prev.content, steps: a } };
    });
  }

  // Import / Export
  function exportCurrent(){
    const data = { name: process.name || "Untitled", content: process.content };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)], { type:"application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = `${(process.name||"process").replace(/[^a-z0-9-_]+/gi,"_")}.json`; a.click();
    URL.revokeObjectURL(url);
  }
  function importFromFile(file: File){
    const fr = new FileReader();
    fr.onload = () => {
      try{
        const raw = String(fr.result||"{}"); const data = JSON.parse(raw);
        const content = normalizeContent(data?.content ?? data);
        setProcess({ id: undefined, name: data?.name ?? "Imported", content });
        setStatus("Imported ✔"); resetStatusSoon();
      } catch { setError("Fichier JSON invalide"); }
    };
    fr.readAsText(file);
  }

  // Auth gating
  if (checking) {
    return <div className="auth-screen"><div className="auth-card">Checking session…</div></div>;
  }
  if (!user) {
    async function handleAuthed(){
      const u = await me(); setUser(u); await refreshList();
    }
    return <div className="auth-screen"><AuthPanel onAuthed={handleAuthed} /></div>;
  }

  return (
    <div className="app-shell">
      {/* Fullscreen diagram behind */}
      <div className="diagram-full">
        <MermaidDiagram content={process.content} layout={layout} onToggleLayout={toggleLayout} />
      </div>

      {/* Topbar overlay */}
      <div className="topbar topbar--overlay">
        <div className="brand">Process App</div>
        <div className="spacer" />
        {(status || error) && (
          <div className={`status toast ${error ? "status--error" : "status--ok"}`}>
            {error ? `⚠️ ${error}` : `✅ ${status}`}
          </div>
        )}
        <div style={{opacity:.75, fontWeight:700, marginRight:8}}>{user.email}</div>
        <button className="btn btn--ghost" onClick={async()=>{ await logout(); location.reload(); }}>Logout</button>
        <button className="btn btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "💾 Save"}</button>
        <button className="btn btn--ghost" onClick={newProcess} disabled={saving}>🧹 New</button>
        {process.id && <button className="btn btn--danger" onClick={() => remove(process.id!)} disabled={saving}>🗑 Delete</button>}
      </div>

      {/* Left floating panel: Processes */}
      <aside className={`floating-panel floating-panel--left ${leftOpen ? "is-open" : "is-closed"}`}>
        <div className="floating-panel__header">
          <strong>Processes</strong>
          <button className="icon-btn" title="Hide" onClick={()=>setLeftOpen(false)}>⯈</button>
        </div>
        <div className="floating-panel__body">
          <ProcessSidebar
            pinned
            list={list}
            onSelect={loadOne}
            onDelete={remove}
            onNew={newProcess}
            onExportCurrent={exportCurrent}
            onImportFile={importFromFile}
          />
        </div>
      </aside>
      {!leftOpen && (
        <button className="edge-toggle edge-toggle--left" onClick={()=>setLeftOpen(true)} title="Show processes">☰</button>
      )}

      {/* Right floating panel: Editor */}
      <aside className={`floating-panel floating-panel--right ${rightOpen ? "is-open" : "is-closed"}`}>
        <div className="floating-panel__header">
          <strong>Editor</strong>
          <button className="icon-btn" title="Hide" onClick={()=>setRightOpen(false)}>⯇</button>
        </div>
        <div className="floating-panel__body" style={{ display:"grid", gap:16 }}>
          <div className="card card--pad"><EditorMeta process={process} onChange={setProcess} /></div>
          <div className="card card--pad">
            <LanesPanel lanes={process.content.lanes} onAdd={addLane} onRename={renameLane} onDelete={deleteLane} onReorder={reorderLanes} />
          </div>
          <div className="card card--pad">
            <StepsPanel steps={process.content.steps} lanes={process.content.lanes} onAdd={addStep} onRename={renameStep} onReassign={reassignStepLane} onDelete={deleteStep} onReorder={reorderSteps} />
          </div>
        </div>
      </aside>
      {!rightOpen && (
        <button className="edge-toggle edge-toggle--right" onClick={()=>setRightOpen(true)} title="Show editor">✎</button>
      )}
    </div>
  );
}
