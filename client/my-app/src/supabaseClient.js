import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY?.trim();

const getConfigError = () => {
  if (!SUPABASE_URL) {
    return "Missing REACT_APP_SUPABASE_URL in client/my-app/.env.";
  }

  if (!SUPABASE_ANON_KEY) {
    return "Missing REACT_APP_SUPABASE_ANON_KEY in client/my-app/.env.";
  }

  try {
    new URL(SUPABASE_URL);
  } catch (_error) {
    return "REACT_APP_SUPABASE_URL is not a valid URL.";
  }

  return null;
};

const assertSupabaseHostReachable = async () => {
  if (typeof fetch !== "function") {
    return;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 5000);

  try {
    await fetch(SUPABASE_URL, {
      method: "GET",
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (_error) {
    throw new Error(
      "Supabase project URL could not be reached. Update the URL/key in client/my-app/.env with a live Supabase project."
    );
  } finally {
    window.clearTimeout(timeoutId);
  }
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const loginWithGoogle = async () => {
  const configError = getConfigError();
  if (configError) {
    throw new Error(configError);
  }

  await assertSupabaseHostReachable();

  const redirectTo =
    typeof window !== "undefined" ? window.location.origin : undefined;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      ...(redirectTo ? { redirectTo } : {}),
      skipBrowserRedirect: true,
    },
  });

  if (error) {
    throw error;
  }

  if (!data?.url) {
    throw new Error("Supabase did not return a Google login URL.");
  }

  if (typeof window !== "undefined") {
    window.location.assign(data.url);
  }
};

export const logoutUser = async () => {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
};
