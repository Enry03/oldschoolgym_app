// Invia una notifica dell'app sui telefoni dell'utente (Web Push).
// Chiamata solo dal database (trigger su public.notifications) con un segreto condiviso.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Metodo non consentito' }, 405)
  const secret = Deno.env.get('PUSH_HOOK_SECRET') ?? ''
  if (!secret || !safeEqual(req.headers.get('x-push-secret') ?? '', secret)) return json({ error: 'Non autorizzato' }, 401)

  let id = ''
  try {
    id = String((await req.json()).notification_id ?? '')
  } catch {
    return json({ error: 'Richiesta non valida' }, 400)
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Richiesta non valida' }, 400)

  webpush.setVapidDetails(
    Deno.env.get('VAPID_SUBJECT') ?? 'mailto:info@oldschoolgympineto.it',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: n } = await db.from('notifications').select('id, user_id, title, body, link, kind').eq('id', id).maybeSingle()
  if (!n) return json({ ok: true, sent: 0 })
  const { data: subs } = await db.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', n.user_id)
  if (!subs?.length) return json({ ok: true, sent: 0 })

  const link = typeof n.link === 'string' && n.link.startsWith('/') && !n.link.startsWith('//') ? n.link : '/app/notifiche'
  const payload = JSON.stringify({ title: n.title, body: n.body ?? '', url: link, tag: n.kind ?? 'info' })

  let sent = 0
  const gone: string[] = []
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 6, urgency: 'high' })
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        if (code === 404 || code === 410) gone.push(s.id)
      }
    }),
  )
  if (gone.length) await db.from('push_subscriptions').delete().in('id', gone)
  if (sent) await db.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).eq('user_id', n.user_id)
  return json({ ok: true, sent, removed: gone.length })
})
