import { createClient } from "@supabase/supabase-js";

// Singleton to avoid multiple GoTrueClient warnings during Vite HMR
const globalForSupabase = globalThis;

export const supabase =
  globalForSupabase.__kizuna_supabase ??
  createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: localStorage
      }
    }
  );

globalForSupabase.__kizuna_supabase = supabase;
