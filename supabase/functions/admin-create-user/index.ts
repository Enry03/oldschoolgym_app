// Crea un nuovo iscritto dalla reception e gli invia l'email per impostare la password.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { cors, json } from '../_shared/cors.ts'

const ROLES = ['client', 'trainer', 'reception', 'admin']

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

  const { data: me } = await admin.from('profiles').select('role, is_active, approval_status').eq('id', u.user.id).maybeSingle()
  if (!me?.is_active || me.approval_status !== 'approved' || !['admin', 'reception'].includes(me.role)) return json({ error: 'Non autorizzato' }, 403)

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Richiesta non valida' }, 400)
  }
  const email = String(body.email ?? '').trim().toLowerCase()
  const first_name = String(body.first_name ?? '').trim().slice(0, 80)
  const last_name = String(body.last_name ?? '').trim().slice(0, 80)
  const phone = String(body.phone ?? '').trim().slice(0, 40)
  let role = ROLES.includes(body.role) ? body.role : 'client'
  if (me.role !== 'admin') role = 'client' // solo l'admin crea staff
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || !first_name) return json({ error: 'Nome ed email validi sono obbligatori' }, 400)

  // Il redirect deve restare sul dominio dell'app
  const origin = req.headers.get('origin') ?? ''
  const redirectTo = typeof body.redirect_to === 'string' && origin && body.redirect_to.startsWith(origin + '/') ? body.redirect_to : undefined

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { first_name, last_name, phone, consent_privacy: false },
    redirectTo,
  })
  if (error) return json({ error: error.message.includes('already') ? 'Esiste già un account con questa email' : error.message }, 400)

  // Creato dallo staff in reception: l'iscrizione è già verificata di persona, quindi approvata
  const { error: pErr } = await admin
    .from('profiles')
    .update({ role, approval_status: 'approved', approved_at: new Date().toISOString(), approved_by: u.user.id })
    .eq('id', data.user.id)
  if (pErr) return json({ error: 'Account creato ma non approvato: approvalo dalla dashboard' }, 500)
  await admin.from('notifications').insert({
    user_id: data.user.id,
    title: 'Benvenuto in OldSchool Gym! 🥊',
    body: 'Completa il profilo e prenota la tua prima lezione.',
    kind: 'welcome',
    link: '/app/profilo',
  })
  return json({ ok: true, id: data.user.id })
})
