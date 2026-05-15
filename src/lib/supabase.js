import { createClient } from '@supabase/supabase-js'

const REGISTRY_URL     = import.meta.env.VITE_REGISTRY_URL
const REGISTRY_ANON_KEY = import.meta.env.VITE_REGISTRY_ANON_KEY

if (!REGISTRY_URL || !REGISTRY_ANON_KEY) {
  console.error('Missing VITE_REGISTRY_URL or VITE_REGISTRY_ANON_KEY in .env.local')
}

export const supabase = createClient(REGISTRY_URL, REGISTRY_ANON_KEY, {
  auth: {
    persistSession: true,
    storageKey: 'fs_admin_session',
    autoRefreshToken: true,
  },
})
