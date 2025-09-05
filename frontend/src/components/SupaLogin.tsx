import React, { useState } from "react";
import { useAuth } from "../auth/SupaAuthContext";
import { useNavigate } from "react-router-dom";

import { supabase } from "../services/supabaseClient";

const SupaLogin: React.FC = () => {
  const { login, loading, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
        navigate("/");
      } else {
        const { data, error: regError } = await supabase.auth.signUp({ email, password });
        if (regError) throw regError;
        setError("Compte créé ! Vérifiez votre boîte mail pour valider l'inscription.");
        setMode("login");
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleOAuth = async (provider: "google" | "github") => {
    setError(null);
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({ provider });
      if (oauthError) throw oauthError;
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (user) return <div className="auth-screen"><div className="auth-card">Connecté en tant que {user.email}</div></div>;

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <div style={{ textAlign: "center", marginBottom: 8 }}>
          <img src="https://supabase.com/favicon.ico" alt="Supabase" style={{ width: 48, marginBottom: 8 }} />
          <h2 className="h1" style={{ color: "#175e7a" }}>
            {mode === "login" ? "Connexion" : "Créer un compte"}
          </h2>
        </div>
        <input
          className="input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          type="password"
          placeholder="Mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        <button className="btn btn--primary" type="submit" disabled={loading}>
          {mode === "login" ? "Se connecter" : "Créer le compte"}
        </button>
        <button className="btn btn--link" type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}
        >
          {mode === "login" ? "Créer un compte" : "Déjà inscrit ? Se connecter"}
        </button>
        <div style={{ textAlign: "center", margin: "12px 0 0 0" }}>
          <span style={{ color: "#888", fontSize: 14 }}>ou</span>
        </div>
        <button className="btn btn--ghost" type="button" onClick={() => handleOAuth("google")}
        >
          <img src="https://upload.wikimedia.org/wikipedia/commons/4/4a/Logo_2013_Google.png" alt="Google" style={{ width: 20, verticalAlign: "middle", marginRight: 8 }} />
          Connexion avec Google
        </button>
        <button className="btn btn--ghost" type="button" onClick={() => handleOAuth("github")}
        >
          <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub" style={{ width: 20, verticalAlign: "middle", marginRight: 8 }} />
          Connexion avec GitHub
        </button>
        {error && <div style={{ color: "#d32f2f", textAlign: "center", marginTop: 8 }}>{error}</div>}
      </form>
    </div>
  );
};

export default SupaLogin;
