import { supabase } from "./supabaseClient";

export async function listDepartements() {
  const { data, error } = await supabase.from("Departement").select("*");
  if (error) throw error;
  return data;
}

export async function getDepartement(id: number) {
  const { data, error } = await supabase.from("Departement").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createDepartement(departement: { Name: string }) {
  const { data, error } = await supabase.from("Departement").insert([departement]).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateDepartement(id: number, departement: { Name?: string }) {
  const { data, error } = await supabase.from("Departement").update(departement).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteDepartement(id: number) {
  const { error } = await supabase.from("Departement").delete().eq("id", id);
  if (error) throw error;
}