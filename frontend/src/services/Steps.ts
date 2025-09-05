import { supabase } from "./supabaseClient";

export async function listSteps() {
  const { data, error } = await supabase.from("Step").select("*");
  if (error) throw error;
  return data;
}

export async function getStep(id: number) {
  const { data, error } = await supabase.from("Step").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createStep(step: { Name: string; Action: number }) {
  const { data, error } = await supabase.from("Step").insert([step]).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateStep(id: number, step: { Name?: string; Action?: number }) {
  const { data, error } = await supabase.from("Step").update(step).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteStep(id: number) {
  const { error } = await supabase.from("Step").delete().eq("id", id);
  if (error) throw error;
}