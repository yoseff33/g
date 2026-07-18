import { createClient } from '@supabase/supabase-js';

// Load environment variables with safe fallbacks to prevent runtime crashes
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://agwbjvtliagyfmkrxdfw.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Safely construct the client, providing a helper variable to detect if it is properly configured
export const isSupabaseConfigured = 
  !!import.meta.env.VITE_SUPABASE_URL && 
  !!import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(
  supabaseUrl, 
  supabaseAnonKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-key'
);
