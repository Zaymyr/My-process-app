// src/Editor.tsx
import React, { useEffect, useMemo, useState } from "react";
import { normalizeContent, uid } from "./utils";
import type { Lane, Process, ProcStep } from "./types";
import {
  listProcesses, getProcess, createProcess, updateProcess, deleteProcess
} from "./services/processService";
import { useAuth } from "./auth/SupaAuthContext";

import MermaidDiagram from "./MermaidDiagram";
import SupaLogin from "./components/SupaLogin";
// ...imports nettoyés, ancienne interface supprimée...
// ...existing code...

const emptyProcess: Process = {
  name: "",
  content: { goal: "", trigger: "", lanes: [], steps: [], metrics: [], actions: [], roles: [] },
};

/* -------------------- Top-level auth gate -------------------- */
export default function Editor() {
  const { user, loading, logout } = useAuth();

  if (loading) return <div>Chargement de la session...</div>;
  if (!user) return <SupaLogin />;

  // Logged in → mount the real editor (its hooks run consistently every render)
  return <AuthedEditor user={user} onLogout={logout} />;
}

/* -------------------- Real editor (only when authed) -------------------- */
function AuthedEditor({ user, onLogout }: { user: any; onLogout: () => Promise<void> | void }) {
  // All hooks live here and always run in the same order:
  const [process, setProcess] = useState<Process>(emptyProcess);
  const [list, setList] = useState<Process[]>([]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [layout, setLayout] = useState<"horizontal" | "vertical">(
    () => (localStorage.getItem("layoutMode") as "horizontal" | "vertical") || "horizontal"
  );
  const [leftOpen, setLeftOpen]   = useState(true);   // processes panel
  const [rightOpen, setRightOpen] = useState(true);   // editor panel
  // Load list only when we’re authenticated
  useEffect(() => { refreshList(); }, []);

  async function refreshList() {
    try { setList(await listProcesses()); }
    catch (e: any) { setError(e?.message || "Failed to load list"); }
  }

  /* ---------------- CRUD ---------------- */
  function resetStatusSoon(){ setTimeout(() => setStatus(""), 1200); }

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
    try {
      const p = await getProcess(id);
      p.content = normalizeContent(p.content);
      setProcess(p);
      setStatus("Loaded ✔");
      setSidebarOpen(false);
    } catch (e: any) {
      setError(e?.message || "Load failed");
    } finally { resetStatusSoon(); }
  }

  async function remove(id: number) {
    if (!window.confirm("Supprimer ce process ?")) return;
    setError(""); setStatus("Deleting…");
    try {
      await deleteProcess(id);
      if (process.id === id) setProcess(emptyProcess);
      await refreshList();
      setStatus("Deleted ✔");
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally { resetStatusSoon(); }
  }

  function newProcess() {
    setProcess(prev => ({
      ...emptyProcess,
      content: { ...emptyProcess.content, },      
    }));
    setSidebarOpen(false);
  }

  /* --------------- Lanes --------------- */
  function addLane(){
    const lane: Lane = { id: uid("lane"), name: "New lane" };
    setProcess(prev => ({ ...prev, content: { ...prev.content, lanes: [...prev.content.lanes, lane] }}));
  }
  function renameLane(id: string, name: string){
    setProcess(prev => ({
      ...prev,
      content: { ...prev.content, lanes: prev.content.lanes.map(l => l.id===id?{...l,name}:l) }
    }));
  }
  function deleteLane(id: string){
    setProcess(prev => ({
      ...prev,
      content: {
        ...prev.content,
        lanes: prev.content.lanes.filter(l => l.id !== id),
        steps: prev.content.steps.map(s => s.laneId===id?{...s,laneId:null}:s),
      }
    }));
  }
  function reorderLanes(from: number, to: number){
    if (from === to) return;
    setProcess(prev => {
      const a = [...prev.content.lanes]; const [m] = a.splice(from,1); a.splice(to,0,m);
      return { ...prev, content: { ...prev.content, lanes: a } };
    });
  }

  /* --------------- Steps --------------- */
  function addStep(){
    const defaultLaneId = process.content.lanes[0]?.id ?? null;
    const step: ProcStep = { id: uid("step"), label: "New step", laneId: defaultLaneId };
    setProcess(prev => ({ ...prev, content: { ...prev.content, steps: [...prev.content.steps, step] } }));
  }
  function renameStep(id: string, label: string){
    setProcess(prev => ({
      ...prev,
      content: { ...prev.content, steps: prev.content.steps.map(s => s.id===id?{...s,label}:s) }
    }));
  }
  function reassignStepLane(id: string, laneId: string | null){
    setProcess(prev => ({
      ...prev,
      content: { ...prev.content, steps: prev.content.steps.map(s => s.id===id?{...s,laneId}:s) }
    }));
  }
  function deleteStep(id: string){
    setProcess(prev => ({
      ...prev,
      content: { ...prev.content, steps: prev.content.steps.filter(s => s.id !== id) }
    }));
  }
  function reorderSteps(from: number, to: number){
    if (from === to) return;
    setProcess(prev => {
      const a = [...prev.content.steps]; const [m] = a.splice(from,1); a.splice(to,0,m);
      return { ...prev, content: { ...prev.content, steps: a } };
    });
  }

  /* --------------- Export / Import --------------- */
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
        const raw = String(fr.result || "{}");
        const data = JSON.parse(raw);
        const content = normalizeContent(data?.content ?? data);
        setProcess({ id: undefined, name: data?.name ?? "Imported", content });
        setStatus("Imported ✔"); resetStatusSoon();
      } catch { setError("Fichier JSON invalide"); }
    };
    fr.readAsText(file);
  }

  function toggleLayout() {
    setLayout(prev => {
      const next = prev === "horizontal" ? "vertical" : "horizontal";
      localStorage.setItem("layoutMode", next);
      return next;
    });
  }

  return (
    <div className="app-shell" style={{ width: '100vw', overflow: 'hidden' }}>
      {/* Header full-width */}
      <header className="topbar" style={{
        width: '100vw',
        left: 0,
        right: 0,
        position: 'fixed',
        top: 0,
        zIndex: 1000,
        margin: 0,
        borderRadius: 0,
        height: 48,
        minHeight: 48,
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        boxSizing: 'border-box',
        background: '#fff',
        borderBottom: '1px solid #eee',
      }}>
        <span className="brand">Process App</span>
        <span className="spacer" />
        <span style={{ opacity: .9, fontWeight: 500 }}>{user.email}</span>
        <button className="btn btn--ghost" onClick={async () => { await onLogout(); location.reload(); }}>Déconnexion</button>
      </header>

      {/* Layout principal : panels latéraux + diagramme */}
      <div className="layout3" style={{
        marginTop: 48, // header height
        minHeight: 'calc(100vh - 48px)',
        height: 'calc(100vh - 48px)',
        position: 'relative',
        width: '100vw',
        background: '#fafbfc', // couleur de fond uniforme
      }}>
        {/* Panel gauche flottant */}
        <aside
          className="sidebar-panel"
          style={{
            position: 'fixed',
            top: 70,
            bottom: 32,
            left: 0,
            width: leftOpen ? 260 : 0,
            background: leftOpen ? '#fff' : 'transparent',
            boxShadow: leftOpen ? '2px 0 8px rgba(0,0,0,0.04)' : 'none',
            zIndex: 100,
            transition: 'width .2s',
            display: leftOpen ? 'flex' : 'none',
            flexDirection: 'column',
            overflowY: 'auto',
            overflowX: 'visible',
            borderRight: leftOpen ? '1px solid #eee' : 'none',
            paddingTop: leftOpen ? 32 : 0,
            paddingBottom: leftOpen ? 32 : 0,
            marginTop: 16,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
          }}
        >
          {leftOpen && (
            <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              {/* Titre en haut, centré horizontalement */}
              <div style={{ width: '100%', textAlign: 'center', padding: '8px 0', fontWeight: 'bold', fontSize: '1.1em' }}>
                Panel gauche
              </div>
              <div className="sidebar-panel__list" style={{ padding: 0, flex: 1, marginTop: 16 }}>
                {/* Emplacement pour les éléments du panel gauche */}
                <section style={{ marginBottom: 24 }}>
                  <strong>Processus</strong>
                  {/* TODO: Intégrer la liste des processus */}
                </section>
                <section style={{ marginBottom: 24 }}>
                  <strong>Départements</strong>
                  {/* TODO: Intégrer la liste des départements */}
                </section>
                <section>
                  <strong>Rôles</strong>
                  {/* TODO: Intégrer la liste des rôles */}
                </section>
              </div>
            </div>
          )}
        </aside>
        {/* Bouton collapse flottant sur le diagramme, centré verticalement */}
        <button
          className="btn btn--ghost"
          onClick={() => setLeftOpen(!leftOpen)}
          style={{
            position: 'fixed',
            left: leftOpen ? 260 : 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 101,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            background: '#fff',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #eee',
          }}
        >{leftOpen ? '⯈' : '⯇'}</button>

        {/* Panel droit flottant */}
        <aside
          className="sidebar-panel"
          style={{
            position: 'fixed',
            top: 70,
            bottom: 32,
            right: 0,
            width: rightOpen ? 260 : 0,
            background: rightOpen ? '#fff' : 'transparent',
            boxShadow: rightOpen ? '-2px 0 8px rgba(0,0,0,0.04)' : 'none',
            zIndex: 100,
            transition: 'width .2s',
            display: rightOpen ? 'flex' : 'none',
            flexDirection: 'column',
            overflowY: 'auto',
            overflowX: 'visible',
            borderLeft: rightOpen ? '1px solid #eee' : 'none',
            paddingTop: rightOpen ? 32 : 0,
            paddingBottom: rightOpen ? 32 : 0,
            marginTop: 16,
            borderBottomLeftRadius: 20,
            borderBottomRightRadius: 20,
          }}
        >
          {rightOpen && (
            <div style={{ height: '100%', position: 'relative', display: 'flex', flexDirection: 'column' }}>
              {/* Titre en haut, centré horizontalement */}
              <div style={{ width: '100%', textAlign: 'center', padding: '8px 0', fontWeight: 'bold', fontSize: '1.1em' }}>
                Panel droit
              </div>
              <div className="sidebar-panel__list" style={{ padding: 0, flex: 1, marginTop: 16 }}>
                {/* Emplacement pour les éléments du panel droit */}
                <section style={{ marginBottom: 24 }}>
                  <strong>Menu utilisateur</strong>
                  {/* TODO: Intégrer le menu des processus de l'utilisateur */}
                </section>
                <section style={{ marginBottom: 24 }}>
                  <strong>Départements</strong>
                  {/* TODO: Intégrer la gestion des départements */}
                </section>
                <section>
                  <strong>Rôles</strong>
                  {/* TODO: Intégrer la gestion des rôles */}
                </section>
              </div>
            </div>
          )}
        </aside>
        {/* Bouton collapse flottant sur le diagramme, centré verticalement */}
        <button
          className="btn btn--ghost"
          onClick={() => setRightOpen(!rightOpen)}
          style={{
            position: 'fixed',
            right: rightOpen ? 260 : 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 101,
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            background: '#fff',
            borderRadius: '50%',
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #eee',
          }}
        >{rightOpen ? '⯇' : '⯈'}</button>

        {/* Diagramme central, occupe tout l'espace */}
        <main className="diagram-card" style={{
          minHeight: '100%',
          height: '100%',
          width: '100vw',
          position: 'relative',
          zIndex: 1,
          background: 'transparent',
        }}>
          <MermaidDiagram content={process.content} layout={layout} onToggleLayout={toggleLayout} />
          {/* Boutons de layout affichés une seule fois en bas à droite */}
          <div
            style={{
              position: 'fixed',
              bottom: 24,
              right: 24,
              zIndex: 2000,
              display: 'flex',
              gap: 8,
              background: 'rgba(255,255,255,0.95)',
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              padding: '8px 16px',
              alignItems: 'center',
            }}
          >
            <button
              className={layout === 'horizontal' ? 'btn btn--primary' : 'btn btn--ghost'}
              onClick={() => setLayout('horizontal')}
            >Horizontal</button>
            <button
              className={layout === 'vertical' ? 'btn btn--primary' : 'btn btn--ghost'}
              onClick={() => setLayout('vertical')}
            >Vertical</button>
          </div>
        </main>
      </div>
    </div>
  );
}
