import { supabase } from "./supabaseClient.js";

// Redirects to login.html if there's no active session. Call at the top of
// every protected page before rendering anything that touches user data.
export async function requireSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    window.location.replace("login.html");
    return null;
  }
  return session;
}

export async function signInWithPassword(email, password) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOut() {
  await supabase.auth.signOut();
  window.location.replace("index.html");
}
