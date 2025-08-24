import { api } from "../api";

export async function me(){
  try {
    const { data } = await api.get("/auth/me");
    return data.user as { id:number; email:string; name?:string } | null;
  } catch (e:any) {
    if (e?.response?.status === 401) return null;
    throw e;
  }
}
export async function login(email: string, password: string){
  const { data } = await api.post("/auth/login", { email, password });
  return data.user;
}
export async function register(email: string, password: string, name?: string){
  const { data } = await api.post("/auth/register", { email, password, name });
  return data.user;
}
export async function logout(){
  await api.post("/auth/logout");
}
