import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, checked } = useAuth();
  const loc = useLocation();
  if (!checked) return <div className="auth-screen"><div className="auth-card">Checking session…</div></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: loc }} />;
  return <>{children}</>;
}
