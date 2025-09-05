import { supabase } from "./supabaseClient";

export async function listUsers() {
  const { data, error } = await supabase.from("User").select("*");
  if (error) throw error;
  return data;
}

export async function getUser(id: number) {
  const { data, error } = await supabase.from("User").select("*").eq("id", id).single();
  if (error) throw error;
  return data;
}

export async function createUser(user: { Name: string; Email: string; Role: number }) {
  const { data, error } = await supabase.from("User").insert([user]).select("*").single();
  if (error) throw error;
  return data;
}

export async function updateUser(id: number, user: { Name?: string; Email?: string; Role?: number }) {
  const { data, error } = await supabase.from("User").update(user).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function deleteUser(id: number) {
  const { error } = await supabase.from("User").delete().eq("id", id);
  if (error) throw error;
}