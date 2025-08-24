import React, { useEffect, useState } from "react";
import { normalizeContent, uid } from "./utils";
import type { Lane, Process, ProcStep } from "./types";
import { listProcesses, getProcess, createProcess, updateProcess, deleteProcess } from "./services/processService";
import EditorMeta from "./components/EditorMeta";
import LanesPanel from "./components/LanesPanel";
import StepsPanel from "./components/StepsPanel";
import MermaidDiagram from "./MermaidDiagram";
import ProcessSidebar from "./components/ProcessSidebar";

const emptyProcess: Process = {
  name: "",
  content: { goal: "", trigger: "", lanes: [], steps: [], metrics: [] },
};

export default function Editor() {
  const [process, setProcess] = useState<Process>(emptyProcess);
  const [list, setList] = useState<Process[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  useEffect(() => { refreshList(); }, []);
  async function refreshList() {
    try { setList(await listProcesses()); }
    catch (e: any) { setError(e?.message || "Failed to load list"); }
  }

  // CRUD
  async function save() {
    setSaving(true); setError(""); setStatus("");
    try {
      if (!process.id) { await createProcess(process); setStatus("Created ✔"); }
      else { await updateProcess(process); setStatus("Saved ✔"); }
      await refreshList();
      setProcess(emptyProcess);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Save failed");
    } finally { setSaving(false); resetStatusSoon(); }
  }
  async function loadOne(id: number) {
    setError(""); setStatus("Loading…");
    try { const p = await getProcess(id); p.content = normalizeContent(p.content); setProcess(p); setStatus("Loaded ✔"); setSidebarOpen(false); }
    catch (e: any) { setError(e?.message || "Load failed"); }
    finally { resetStatusSoon(); }
  }
  async function remove(id: number) {
    if (!window.confirm("Supprimer ce process ?")) return;
    setError(""); setStatus("Deleting…");
    try { await deleteProcess(id); if (process.id === id) setProcess(emptyProcess); await refreshList(); setStatus("Deleted ✔"); }
    catch (e: any) { setError(e?.message || "Delete failed"); }
    finally { resetStatusSoon(); }
  }
  function newProcess() {
    setProcess(prev => ({ ...emptyProcess, content: { ...emptyProcess.content, lanes: prev.content.lanes } }));
    setSidebarOpen(false);
  }
  function resetStatusSoon(){ setTimeout(() => setStatus(""), 1200); }

  // Lanes
  function addLane(){ const lane: Lane = { id: uid("lane"), name: "New lane" };
    setProcess(prev => ({ ...prev, content: { ...prev.content, lanes: [...prev.content.lanes, lane] } }));
  }
  function renameLane(id: string, name: string){
    setProcess(prev => ({ ...prev, content: { ...prev.content, lanes: prev.content.lanes.map(l => l.id===id?{...l,name}:l) } }));
  }
  function deleteLane(id: string){
    setProcess(prev => ({ ...prev, content: { ...prev.content,
      lanes: prev.content.lanes.filter(l => l.id !== id),
      steps: prev.content.steps.map(s => s.laneId===id?{...s,laneId:null}:s) } }));
  }
  function reorderLanes(from: number, to: number){
    if (from === to) return;
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
  function renameStep(id: string, label: string){
    setProcess(prev => ({ ...prev, content: { ...prev.content, steps: prev.content.steps.map(s => s.id===id?{...s,label}:s) } }));
  }
  function reassignStepLane(id: string, laneId: string | null){
    setProcess(prev => ({ ...prev, content: { ...prev.content, steps: prev.content.steps.map(s => s.id===id?{...s,laneId}:s) } }));
  }
  function deleteStep(id: string){
    setProcess(prev => ({ ...prev, content: { ...prev.content, steps: prev.content.steps.filter(s => s.id !== id) } }));
  }
  function reorderSteps(from: number, to: number){
    if (from === to) return;
    setProcess(prev => {
      const a = [...prev.content.steps]; const [m] = a.splice(from,1); a.splice(to,0,m);
      return { ...prev, content: { ...prev.content, steps: a } };
    });
  }

  // Export / Import (triggered from sidebar)
  function exportCurrent(){
    const data = { name: process.name || "Untitled", content: process.content };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const safeName = (process.name || "process").replace(/[^a-z0-9-_]+/gi, "_");
    const a = document.createElement("a"); a.href = url; a.download = `${safeName}.json`; a.click(); URL.revokeObjectURL(url);
  }
  function importFromFile(file: File){
    const fr = new FileReader();
    fr.onload = () => {
      try{
        const raw = String(fr.result || "{}"); const data = JSON.parse(raw);
        const content = normalizeContent(data?.content ?? data);
        setProcess({ id: undefined, name: data?.name ?? "Imported", content }); setStatus("Imported ✔"); resetStatusSoon();
      } catch { setError("Fichier JSON invalide"); }
    };
    fr.readAsText(file);
  }

  return (
    <div className="container">
      {/* Mobile overlay sidebar */}
      <div className="show-mobile">
        <ProcessSidebar
          list={list}
          onSelect={loadOne}
          onDelete={remove}
          onNew={newProcess}
          onExportCurrent={exportCurrent}
          onImportFile={importFromFile}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      </div>

      {/* Top bar */}
      <div className="topbar">
        <button className="icon-btn show-mobile" title="Toggle process panel" onClick={() => setSidebarOpen(v => !v)}>☰</button>
        <div className="brand">Process App</div>
        <div className="spacer" />
        {(status || error) && (
          <div className={`status toast ${error ? "status--error" : "status--ok"}`}>
            {error ? `⚠️ ${error}` : `✅ ${status}`}
          </div>
        )}
        <button className="btn btn--primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "💾 Save"}</button>
        <button className="btn btn--ghost" onClick={newProcess} disabled={saving}>🧹 New</button>
        {process.id && <button className="btn btn--danger" onClick={() => remove(process.id!)} disabled={saving}>🗑 Delete</button>}
      </div>

      {/* 3-column layout: left=sidebar (desktop), middle=diagram, right=editor panels */}
      <div className="layout3">
        {/* Left: Pinned sidebar (desktop) */}
        <div className="show-desktop">
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

        {/* Middle: Mermaid diagram only */}
        <div className="card diagram-card">
          <MermaidDiagram content={process.content} />
        </div>

        {/* Right: Editor panels */}
        <div style={{ display: "grid", gap: 16 }}>
          <div className="card card--pad">
            <EditorMeta process={process} onChange={setProcess} />
          </div>
          <div className="card card--pad">
            <LanesPanel
              lanes={process.content.lanes}
              onAdd={addLane}
              onRename={renameLane}
              onDelete={deleteLane}
              onReorder={reorderLanes}
            />
          </div>
          <div className="card card--pad">
            <StepsPanel
              steps={process.content.steps}
              lanes={process.content.lanes}
              onAdd={addStep}
              onRename={renameStep}
              onReassign={reassignStepLane}
              onDelete={deleteStep}
              onReorder={reorderSteps}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
