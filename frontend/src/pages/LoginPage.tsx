import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AuthPanel from "../components/AuthPanel";

export default function LoginPage(){
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation() as any;
  const go = () => navigate(loc.state?.from?.pathname || "/app", { replace:true });

  return (
    <div className="auth-screen">
      {/* Reuse your existing AuthPanel but wire to context */}
      <AuthPanel onAuthed={go}
                 onLogin={async (email, pass)=>{ await login(email, pass); go(); }}
                 onRegister={async (email, pass, name)=>{ await register(email, pass, name); go(); }} />
    </div>
  );
}
