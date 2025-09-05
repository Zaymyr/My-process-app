import React, { useEffect, useState } from "react";
import { supabase } from "../services/supabaseClient";

const AuthCallback: React.FC = () => {
  const [message, setMessage] = useState("Validation en cours...");

  useEffect(() => {
    // Vérifie la session après redirection
    supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        setMessage("Erreur lors de la validation. Veuillez réessayer ou contacter le support.");
      } else if (data?.user?.email_confirmed_at) {
        setMessage("Votre email est validé ! Vous pouvez maintenant vous connecter.");
      } else {
        setMessage("Validation en attente. Vérifiez votre email ou réessayez.");
      }
    });
  }, []);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f6fcfd" }}>
      <div style={{ background: "#fff", borderRadius: 16, boxShadow: "0 4px 24px #0002", padding: 32, minWidth: 340, maxWidth: 360, textAlign: "center" }}>
        <img src="https://supabase.com/favicon.ico" alt="Supabase" style={{ width: 48, marginBottom: 8 }} />
        <h2 style={{ color: "#175e7a", fontWeight: 700, fontSize: 22 }}>Confirmation d'email</h2>
        <div style={{ marginTop: 18, fontSize: 17 }}>{message}</div>
      </div>
    </div>
  );
};

export default AuthCallback;
