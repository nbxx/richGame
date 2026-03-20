import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Admin client using Service Role Key — bypasses RLS
// Only use this in server-side code (API routes, server actions)
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
