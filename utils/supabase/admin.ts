import { createClient } from '@supabase/supabase-js'

// Este cliente utiliza la clave de Service Role y permite saltarse las políticas de RLS.
// ¡MUY IMPORTANTE!: Nunca usar este cliente en componentes de cliente (use client) 
// ni exponerlo al lado público. Solo usar en Server Actions seguras.
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Faltan las variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
