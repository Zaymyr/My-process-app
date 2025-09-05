import { supabase } from "./supabaseClient";

export async function listActions() {
  const { data, error } = await supabase.from("Action").select("*");
  if (error) throw error;
  return data;
}

export async function getAction(id: number) {
  const { data, error } = await supabase.from("Action").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createAction(action: { Num_sequence: number; Name: string; Role: number }) {
  const { data, error } = await supabase.from("Action").insert([action]).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateAction(id: number, action: { Num_sequence?: number; Name?: string; Role?: number }) {
  const { data, error } = await supabase.from("Action").update(action).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteAction(id: number) {
  const { error } = await supabase.from("Action").delete().eq("id", id);
  if (error) throw error;
}