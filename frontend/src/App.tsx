import { AuthProvider, useAuth } from "./auth/SupaAuthContext";
import Editor from "./Editor";
import LoginPage from "./pages/LoginPage";
import AuthCallback from "./pages/AuthCallback";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

function AppShell() {
  const { user, loading, logout } = useAuth();
  if (loading) return <div>Chargement de la session...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Editor />;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/*" element={<AppShell />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;