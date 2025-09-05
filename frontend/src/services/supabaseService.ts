import { supabase } from './supabaseClient';

// Récupérer tous les départements
export async function getDepartements() {
  const { data, error } = await supabase.from('Departement').select('*');
  if (error) throw error;
  return data;
}

// Récupérer tous les rôles
export async function getRoles() {
  const { data, error } = await supabase.from('Role').select('*');
  if (error) throw error;
  return data;
}

// Récupérer tous les utilisateurs
export async function getUsers() {
  const { data, error } = await supabase.from('User').select('*');
  if (error) throw error;
  return data;
}

// Récupérer tous les processus
export async function getProcesses() {
  const { data, error } = await supabase.from('Process').select('*');
  if (error) throw error;
  return data;
}

// Récupérer toutes les actions
export async function getActions() {
  const { data, error } = await supabase.from('Action').select('*');
  if (error) throw error;
  return data;
}

// Récupérer toutes les étapes
export async function getSteps() {
  const { data, error } = await supabase.from('Step').select('*');
  if (error) throw error;
  return data;
}
