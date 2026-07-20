import { createClient } from '@supabase/supabase-js'

const configuredUrl = import.meta.env.VITE_SUPABASE_URL
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isSupabaseConfigured = Boolean(configuredUrl && configuredAnonKey)

// Placeholder values keep the UI loadable while clearly requiring Vercel/local env configuration.
// No production URL or key is stored in the repository.
export const supabase = createClient(
  configuredUrl || 'https://placeholder.supabase.co',
  configuredAnonKey || 'public-anon-key-not-configured',
)
