import { createClient } from "@supabase/supabase-js";

// TODO: Replace with your own Supabase project details
const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const loginWithGoogle = async () => {
  await supabase.auth.signInWithOAuth({ provider: "google" });
};

export const logoutUser = async () => {
  await supabase.auth.signOut();
};

