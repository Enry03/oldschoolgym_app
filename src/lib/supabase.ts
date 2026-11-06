import { createClient } from '@supabase/supabase-js'

// La chiave "publishable" è pubblica per design: la sicurezza è garantita dalle regole RLS del database.
const url = import.meta.env.VITE_SUPABASE_URL ?? 'https://pcphjvleifvnbhyxlcun.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_ad9LYzlBYAFeORbFtXFxog_nSpuX3re'

export const supabase = createClient(url, key, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})

export const SUPABASE_URL = url

export function publicUrl(bucket: string, path?: string | null) {
  if (!path) return null
  if (path.startsWith('http')) return path
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

export async function signedUrl(bucket: string, path?: string | null, seconds = 600) {
  if (!path) return null
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, seconds)
  return data?.signedUrl ?? null
}

/** Messaggio d'errore leggibile da un errore Supabase/Postgres */
export function errMsg(e: unknown): string {
  if (!e) return 'Errore sconosciuto'
  if (typeof e === 'string') return e
  const anyE = e as { message?: string; error_description?: string }
  const m = anyE.message ?? anyE.error_description ?? 'Si è verificato un errore'
  if (m.includes('Invalid login credentials')) return 'Email o password non corretti'
  if (m.includes('User already registered')) return 'Esiste già un account con questa email'
  if (m.includes('Email not confirmed')) return 'Conferma prima la tua email (controlla la posta)'
  if (m.includes('Password should be')) return 'La password deve avere almeno 8 caratteri'
  if (m.includes('row-level security')) return 'Non hai i permessi per questa operazione'
  return m
}
