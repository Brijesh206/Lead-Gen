/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

try {
  if (supabaseUrl && supabaseAnonKey) {
    // This will throw if the URL is invalid (e.g., missing https://)
    new URL(supabaseUrl);
    client = createClient(supabaseUrl, supabaseAnonKey);
  }
} catch (error) {
  console.error("Invalid Supabase configuration:", error);
}

export const supabase = client;
