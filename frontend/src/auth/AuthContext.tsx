import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import * as auth from "../services/authService";

type User = { id:number; email:string; name?:string } | null;
type Ctx = {
  user: User;
  checked: boolean;                   // finished initial /auth/me check
  refresh: () => Promise<void>;
  login: (email:string, pass:string) => Promise<void>;
  register: (email:string, pass:string, name?:string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | null>(null);
export function useAuth(){ const v = useContext(AuthCtx); if(!v) throw new Error("AuthProvider missing"); return v; }

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [checked, setChecked] = useState(false);

  const refresh = useCallback(async () => {
    const u = await auth.me();
    setUser(u);
  }, []);

  useEffect(() => { (async()=>{ await refresh(); setChecked(true); })(); }, [refresh]);

  const doLogin = useCallback(async (email:string, pass:string) => {
    const u = await auth.login(email, pass); setUser(u);
  }, []);
  const doRegister = useCallback(async (email:string, pass:string, name?:string) => {
    const u = await auth.register(email, pass, name); setUser(u);
  }, []);
  const doLogout = useCallback(async () => {
    await auth.logout(); setUser(null);
  }, []);

  return (
    <AuthCtx.Provider value={{ user, checked, refresh, login:doLogin, register:doRegister, logout:doLogout }}>
      {children}
    </AuthCtx.Provider>
  );
}
