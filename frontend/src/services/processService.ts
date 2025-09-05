import { supabase } from "./supabaseClient";
import type { Process } from "../types";

function withParsedContent<T extends { content: any }>(row: T): T {
  if (row && typeof row.content === "string") {
    try { row.content = JSON.parse(row.content); } catch {}
  }
  return row;
}

export async function listProcesses(): Promise<Process[]> {
  const { data, error } = await supabase.from('Process').select('*');
  if (error) throw error;
  return Array.isArray(data) ? data.map(withParsedContent) : [];
}

export async function getProcess(id: number): Promise<Process> {
  const { data, error } = await supabase.from('Process').select('*').eq('id', id).single();
  if (error) throw error;
  return withParsedContent(data);
}

export async function createProcess(p: Process): Promise<Process> {
  const payload = { Name: p.name, content: p.content };
  const { data, error } = await supabase.from('Process').insert([payload]).select('*').single();
  if (error) throw error;
  return withParsedContent(data);
}

export async function updateProcess(p: Process): Promise<Process> {
  if (!p.id) throw new Error("updateProcess: id required");
  const payload = { Name: p.name, content: p.content };
  const { data, error } = await supabase.from('Process').update(payload).eq('id', p.id).select('*').single();
  if (error) throw error;
  return withParsedContent(data);
}

export async function deleteProcess(id: number): Promise<void> {
  const { error } = await supabase.from('Process').delete().eq('id', id);
  if (error) throw error;
}