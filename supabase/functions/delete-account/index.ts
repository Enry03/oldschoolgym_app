// Elimina l'account dell'utente che chiama (GDPR, diritto all'oblio).
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cors, json } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Non autenticato' }, 401)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: u, error: uErr } = await admin.auth.getUser(token)
  if (uErr || !u.user) return json({ error: 'Sessione non valida' }, 401)
  const uid = u.user.id

  const { data: me } = await admin.from('profiles').select('role').eq('id', uid).maybeSingle()
  if (me?.role === 'admin') {
    const { count } = await admin.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'admin').eq('is_active', true)
    if ((count ?? 0) <= 1) return json({ error: "Sei l'unico amministratore: nomina un altro admin prima di eliminare l'account" }, 400)
  }

  // Rimuove i file personali dagli storage privati e pubblici
  for (const bucket of ['avatars', 'certificates', 'progress']) {
    const { data: files } = await admin.storage.from(bucket).list(uid, { limit: 1000 })
    if (files?.length) await admin.storage.from(bucket).remove(files.map((f) => `${uid}/${f.name}`))
  }

  const { error } = await admin.auth.admin.deleteUser(uid)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true })
})
