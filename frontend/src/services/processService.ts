import { api } from "../api";
import type { Process } from "../types";

export async function listProcesses(): Promise<Process[]> {
  const { data } = await api.get("/process");
  return data;
}

export async function getProcess(id: number): Promise<Process> {
  const { data } = await api.get(`/process/${id}`);
  return data;
}

export async function createProcess(p: Process): Promise<Process> {
  const body = { name: p.name || "Untitled", content: p.content };
  const { data } = await api.post("/process", body);
  return data;
}

export async function updateProcess(p: Process): Promise<Process> {
  if (!p.id) throw new Error("Missing id");
  const body = { name: p.name || "Untitled", content: p.content };
  const { data } = await api.put(`/process/${p.id}`, body);
  return data;
}

export async function deleteProcess(id: number): Promise<void> {
  await api.delete(`/process/${id}`);
}
