import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck, Copy, Gift, MessageCircle, Pin, Send, Share2, UserPlus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, Badge, Button, Empty, Field, Input, Loading, PageHeader, PhotoPlaceholder, Sheet, Textarea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { fmtDate, fmtRelative, fmtTime, fullName, roleLabel } from '../../lib/format'
import { useAsync, useNotifications } from '../../lib/hooks'
import { errMsg, publicUrl, supabase } from '../../lib/supabase'
import type { Announcement, Message, Profile, StaffMember } from '../../lib/types'

/* ---------- Notifiche ---------- */
export function NotificationsPage() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const { items, unread, markAllRead } = useNotifications(profile?.id)
  return (
    <div>
      <PageHeader
        title="Notifiche"
        back
        right={
          unread > 0 && (
            <Button size="sm" variant="ghost" icon={<CheckCheck className="size-4" />} onClick={markAllRead}>
              Lette
            </Button>
          )
        }
      />
      {items.length === 0 ? (
        <Empty icon={<Bell className="size-7" />} title="Tutto tranquillo" text="Qui arriveranno promemoria, scadenze e novità della palestra." />
      ) : (
        <div className="space-y-2">
          {items.map((n, i) => (
            <motion.button
              key={n.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.03 } }}
              onClick={async () => {
                if (!n.read_at) await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', n.id)
                if (n.link) nav(n.link)
              }}
              className={`card flex w-full gap-3 p-4 text-left ${!n.read_at ? 'border-gold/40 bg-gold/[0.06]' : ''}`}
            >
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${!n.read_at ? 'bg-gold' : 'bg-transparent'}`} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{n.title}</div>
                {n.body && <div className="mt-0.5 text-sm text-muted">{n.body}</div>}
                <div className="mt-1 text-[11px] text-muted/70">{fmtRelative(n.created_at)}</div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- News ---------- */
export function NewsPage() {
  const { data, loading } = useAsync(async () => {
    const { data } = await supabase.from('announcements').select('*').order('is_pinned', { ascending: false }).order('published_at', { ascending: false }).limit(50)
    return (data as Announcement[]) ?? []
  })
  const [open, setOpen] = useState<Announcement | null>(null)
  return (
    <div>
      <PageHeader title="Bacheca" back kicker="News, eventi e chiusure" />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty title="Nessuna news" />
      ) : (
        <div className="space-y-4">
          {data.map((n, i) => (
            <motion.button key={n.id} onClick={() => setOpen(n)} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }} className="card w-full overflow-hidden p-0 text-left">
              {n.image_url ? <img src={publicUrl('media', n.image_url) ?? ''} alt="" className="aspect-[16/9] w-full object-cover" /> : <PhotoPlaceholder label={n.category} className="aspect-[16/9]" />}
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <Badge tone="gold">{n.category}</Badge>
                  {n.is_pinned && (
                    <Badge tone="blue">
                      <Pin className="size-3" /> In evidenza
                    </Badge>
                  )}
                  <span className="ml-auto text-xs text-muted">{fmtDate(n.published_at, 'd MMM')}</span>
                </div>
                <h3 className="mt-2 font-display text-2xl uppercase leading-tight">{n.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{n.body}</p>
              </div>
            </motion.button>
          ))}
        </div>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.category}>
        {open && (
          <article>
            <h2 className="font-display text-3xl uppercase leading-tight">{open.title}</h2>
            <div className="mt-1 text-xs text-muted">{fmtDate(open.published_at, 'EEEE d MMMM yyyy')}</div>
            <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-cream/90">{open.body}</p>
          </article>
        )}
      </Sheet>
    </div>
  )
}

/* ---------- Messaggi ---------- */
export function MessagesPage() {
  const { profile, isStaff } = useAuth()
  const [params, setParams] = useSearchParams()
  const peerId = params.get('con')
  const { data: contacts, loading } = useAsync(async () => {
    if (isStaff) {
      // lo staff vede i clienti con cui ha conversazioni + i propri clienti
      const { data: msgs } = await supabase.from('messages').select('sender_id, recipient_id').or(`sender_id.eq.${profile!.id},recipient_id.eq.${profile!.id}`).order('created_at', { ascending: false }).limit(300)
      const uuid = /^[0-9a-f-]{36}$/i
      const ids = [...new Set([...(msgs ?? []).flatMap((m) => [m.sender_id, m.recipient_id]), ...(peerId && uuid.test(peerId) ? [peerId] : [])].filter((x) => x !== profile!.id))]
      const { data: mine } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url, role').or(ids.length ? `id.in.(${ids.join(',')}),trainer_id.eq.${profile!.id}` : `trainer_id.eq.${profile!.id}`)
      return (mine as StaffMember[]) ?? []
    }
    const { data } = await supabase.rpc('get_staff')
    return (data as StaffMember[]) ?? []
  }, [profile?.id, peerId])

  const peer = contacts?.find((c) => c.id === peerId)
  if (peerId && peer) return <Chat peer={peer} onBack={() => setParams({})} />

  return (
    <div>
      <PageHeader title="Messaggi" back kicker={isStaff ? 'I tuoi clienti' : 'Scrivi al tuo trainer'} />
      {loading ? (
        <Loading />
      ) : !contacts?.length ? (
        <Empty icon={<MessageCircle className="size-7" />} title="Nessun contatto" />
      ) : (
        <div className="space-y-2">
          {contacts.map((c, i) => (
            <motion.button key={c.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.04 } }} onClick={() => setParams({ con: c.id })} className="card flex w-full items-center gap-3 p-3 text-left">
              <Avatar p={c} size={48} />
              <div className="flex-1">
                <div className="font-semibold">{fullName(c)}</div>
                <div className="text-xs text-muted">{roleLabel[c.role]}</div>
              </div>
              <MessageCircle className="size-5 text-gold" />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  )
}

function Chat({ peer, onBack }: { peer: StaffMember; onBack: () => void }) {
  const { profile } = useAuth()
  const [msgs, setMsgs] = useState<Message[]>([])
  const [text, setText] = useState('')
  const endRef = useRef<HTMLDivElement>(null)
  const me = profile!.id

  useEffect(() => {
    let alive = true
    const load = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${me},recipient_id.eq.${peer.id}),and(sender_id.eq.${peer.id},recipient_id.eq.${me})`)
        .order('created_at')
        .limit(300)
      if (alive) setMsgs((data as Message[]) ?? [])
      await supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', me).eq('sender_id', peer.id).is('read_at', null)
    }
    load()
    const ch = supabase
      .channel(`chat-${me}-${peer.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `recipient_id=eq.${me}` }, (p) => {
        if ((p.new as Message).sender_id === peer.id) load()
      })
      .subscribe()
    return () => {
      alive = false
      supabase.removeChannel(ch)
    }
  }, [me, peer.id])

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [msgs.length])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    const optimistic: Message = { id: crypto.randomUUID(), sender_id: me, recipient_id: peer.id, body, read_at: null, created_at: new Date().toISOString() }
    setMsgs((m) => [...m, optimistic])
    const { error } = await supabase.from('messages').insert({ sender_id: me, recipient_id: peer.id, body })
    if (error) toast.error(errMsg(error))
  }

  return (
    <div className="flex h-[calc(100dvh-9rem)] flex-col">
      <div className="mb-3 flex items-center gap-3">
        <button onClick={onBack} className="text-sm text-gold">
          ← Indietro
        </button>
        <Avatar p={peer} size={40} />
        <div>
          <div className="font-semibold">{fullName(peer)}</div>
          <div className="text-xs text-muted">{roleLabel[peer.role]}</div>
        </div>
      </div>
      <div className="no-scrollbar flex-1 space-y-2 overflow-y-auto rounded-3xl bg-night/60 p-3">
        {msgs.length === 0 && <p className="py-10 text-center text-sm text-muted">Scrivi il primo messaggio 👋</p>}
        <AnimatePresence initial={false}>
          {msgs.map((m) => {
            const mine = m.sender_id === me
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[15px] ${mine ? 'rounded-br-md bg-gold text-ink' : 'rounded-bl-md bg-surface-2'}`}>
                  <div className="whitespace-pre-wrap break-words">{m.body}</div>
                  <div className={`mt-0.5 text-right text-[10px] ${mine ? 'text-ink/60' : 'text-muted'}`}>{fmtTime(m.created_at)}</div>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
      <form onSubmit={send} className="mt-3 flex gap-2">
        <Input value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder="Scrivi un messaggio…" />
        <Button type="submit" aria-label="Invia" className="shrink-0">
          <Send className="size-5" />
        </Button>
      </form>
    </div>
  )
}

/* ---------- Porta un amico ---------- */
export function InvitePage() {
  const { profile } = useAuth()
  const link = `${window.location.origin}/registrati?ref=${profile?.referral_code ?? ''}`
  const [f, setF] = useState({ full_name: '', phone: '', trial_date: '' })
  const [busy, setBusy] = useState(false)
  const { data: friends } = useAsync(async () => {
    const { data } = await supabase.from('profiles').select('id').eq('referred_by', profile!.id)
    return data?.length ?? 0
  }, [profile?.id])

  async function share() {
    const text = `Vieni ad allenarti con me alla OldSchool Gym di Pineto! 🥊 Usa il mio codice ${profile?.referral_code}: ${link}`
    if (navigator.share) {
      try {
        await navigator.share({ title: 'OldSchool Gym', text, url: link })
      } catch {
        /* annullato */
      }
    } else {
      await navigator.clipboard.writeText(text)
      toast.success('Link copiato')
    }
  }
  async function guest(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.from('leads').insert({ full_name: f.full_name, phone: f.phone, trial_date: f.trial_date || null, source: 'Pass ospite', status: 'new', referred_by: profile!.id, notes: `Invitato da ${fullName(profile)}` })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Pass ospite richiesto! La reception lo confermerà.')
    setF({ full_name: '', phone: '', trial_date: '' })
  }

  return (
    <div>
      <PageHeader title="Porta un amico" back kicker="Allenarsi in due è meglio" />
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="grain relative overflow-hidden rounded-3xl bg-gold p-6 text-ink">
        <Gift className="size-10" />
        <div className="mt-3 font-display text-3xl uppercase leading-none">Il tuo codice</div>
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(profile?.referral_code ?? '')
            toast.success('Codice copiato')
          }}
          className="mt-3 flex items-center gap-3 rounded-2xl bg-ink px-5 py-3 font-varsity text-3xl tracking-[0.3em] text-gold"
        >
          {profile?.referral_code} <Copy className="size-5" />
        </button>
        <p className="mt-3 text-sm text-ink/75">Amici iscritti con il tuo codice: <b>{friends ?? 0}</b></p>
        <Button variant="navy" className="mt-4 !bg-ink !text-cream" icon={<Share2 className="size-4" />} onClick={share}>
          Condividi invito
        </Button>
      </motion.div>

      <div className="card mt-5 p-5">
        <div className="flex items-center gap-2">
          <UserPlus className="size-5 text-gold" />
          <h2 className="font-display text-2xl uppercase">Pass ospite</h2>
        </div>
        <p className="mt-1 text-sm text-muted">Porta un amico per un allenamento di prova gratuito.</p>
        <form onSubmit={guest} className="mt-4 space-y-3">
          <Field label="Nome dell'amico">
            <Input required minLength={2} maxLength={120} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefono">
              <Input type="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            </Field>
            <Field label="Quando">
              <Input type="date" value={f.trial_date} onChange={(e) => setF({ ...f, trial_date: e.target.value })} />
            </Field>
          </div>
          <Button type="submit" block loading={busy}>
            Richiedi pass
          </Button>
        </form>
      </div>
    </div>
  )
}

/* ---------- Personal trainer ---------- */
export function PersonalPage() {
  const { profile } = useAuth()
  const { data: staff, loading } = useAsync(async () => {
    const { data } = await supabase.rpc('get_staff')
    return ((data as StaffMember[]) ?? []).filter((s) => s.role === 'trainer')
  })
  const [sel, setSel] = useState<StaffMember | null>(null)
  const [f, setF] = useState({ day: '', time: '', note: '' })
  const [busy, setBusy] = useState(false)
  const mineFirst = useMemo(() => [...(staff ?? [])].sort((a) => (a.id === (profile as Profile | null)?.trainer_id ? -1 : 1)), [staff, profile])

  async function request() {
    if (!sel) return
    if (!f.day) return toast.error('Scegli un giorno')
    setBusy(true)
    const body = `📅 Richiesta personal training\nGiorno: ${fmtDate(f.day, 'EEEE d MMMM')}${f.time ? ` alle ${f.time}` : ''}\n${f.note}`
    const { error } = await supabase.from('messages').insert({ sender_id: profile!.id, recipient_id: sel.id, body })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success(`Richiesta inviata a ${sel.first_name}: ti risponderà in chat`)
    setSel(null)
    setF({ day: '', time: '', note: '' })
  }

  return (
    <div>
      <PageHeader title="Personal" back kicker="Allenamento 1 a 1" />
      {loading ? (
        <Loading />
      ) : !mineFirst.length ? (
        <Empty title="Trainer in arrivo" text="Presto potrai prenotare un personal trainer dall'app." />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {mineFirst.map((t, i) => (
            <motion.button key={t.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.06 } }} whileTap={{ scale: 0.97 }} onClick={() => setSel(t)} className="card overflow-hidden p-0 text-left">
              {t.avatar_url ? <img src={publicUrl('avatars', t.avatar_url) ?? ''} alt="" className="aspect-[3/4] w-full object-cover" /> : <PhotoPlaceholder label="Foto trainer" className="aspect-[3/4]" />}
              <div className="p-3">
                <div className="font-display text-xl uppercase leading-none">{t.first_name}</div>
                <div className="mt-1 text-xs text-muted">{t.id === profile?.trainer_id ? 'Il tuo trainer ★' : 'Personal trainer'}</div>
              </div>
            </motion.button>
          ))}
        </div>
      )}
      <Sheet open={!!sel} onClose={() => setSel(null)} title={`Con ${sel?.first_name ?? ''}`} footer={<Button block size="lg" loading={busy} onClick={request}>Invia richiesta</Button>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giorno">
              <Input type="date" value={f.day} onChange={(e) => setF({ ...f, day: e.target.value })} />
            </Field>
            <Field label="Orario preferito">
              <Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
            </Field>
          </div>
          <Field label="Note">
            <Textarea value={f.note} maxLength={500} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Obiettivo, infortuni, preferenze…" />
          </Field>
          <p className="text-xs text-muted">Il trainer riceve la richiesta in chat e ti conferma l'orario.</p>
        </div>
      </Sheet>
    </div>
  )
}
