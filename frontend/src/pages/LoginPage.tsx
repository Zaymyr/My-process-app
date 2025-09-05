import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthProvider } from "../auth/SupaAuthContext";
import SupaLogin from "../components/SupaLogin";

export default function LoginPage() {
  return (
    <AuthProvider>
      <div className="auth-screen">
        <SupaLogin />
      </div>
    </AuthProvider>
  );
}
