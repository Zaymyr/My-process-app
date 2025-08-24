// src/components/AuthPanel.tsx
import React, { useState } from "react";
import { login, register } from "../services/authService";

export default function AuthPanel({
  onAuthed,
  onLogin,
  onRegister
}: {
  onAuthed: () => void;
  onLogin?: (email:string, pass:string)=>Promise<void>;
  onRegister?: (email:string, pass:string, name?:string)=>Promise<void>;
}) {
  const [mode, setMode] = useState<"login"|"register">("login");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [name, setName] = useState("");   const [err, setErr] = useState("");

  async function submit(e: React.FormEvent){
    e.preventDefault(); setErr("");
    try{
      const user = mode==="login"
        ? await login(email, password)
        : await register(email, password, name);
      onAuthed();
    }catch(e:any){ setErr(e?.response?.data?.error || e?.message || "Failed"); }
  }

  return (
    <div className="card card--pad" style={{maxWidth: 420, margin: "40px auto"}}>
      <h2 className="section__title">Account</h2>
      {err && <div className="status status--error">{err}</div>}
      <form onSubmit={submit} className="grid" style={{gap:12}}>
        {mode==="register" && (
          <div className="field">
            <label className="label">Name</label>
            <input className="input" value={name} onChange={e=>setName(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label className="label">Password</label>
          <input className="input" type="password" value={password} onChange={e=>setPassword(e.target.value)} required />
        </div>
        <button className="btn btn--primary" type="submit">
          {mode==="login" ? "Sign in" : "Create account"}
        </button>
        <button type="button" className="btn btn--ghost" onClick={()=>setMode(m=>m==="login"?"register":"login")}>
          {mode==="login" ? "No account? Register" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
