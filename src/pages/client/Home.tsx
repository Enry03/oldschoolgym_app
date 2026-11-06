import { motion } from 'framer-motion'
import { AlertTriangle, Bell, CalendarPlus, ChevronRight, Dumbbell, Gift, LineChart, MessageCircle, Newspaper, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Card, IconButton, PhotoPlaceholder, Ring, SectionTitle, Skeleton } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { daysUntil, fmtDate, fmtTime, greeting } from '../../lib/format'
import { useAsync, useNotifications } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import type { Announcement, Certificate, Membership, SessionRow } from '../../lib/types'

export function useMyMembership(uid?: string) {
  return useAsync(async () => {
    if (!uid) return null
    const { data } = await supabase.from('memberships').select('*').eq('user_id', uid).order('end_date', { ascending: false, nullsFirst: true }).limit(5)
    const list = (data as Membership[]) ?? []
    const today = new Date().toISOString().slice(0, 10)
    return list.find((m) => m.status === 'active' && (!m.end_date || m.end_date >= today)) ?? list[0] ?? null
  }, [uid])
}

export default function ClientHome() {
  const { profile } = useAuth()
  const nav = useNavigate()
  const { unread } = useNotifications(profile?.id)
  const { data: membership, loading: mLoading } = useMyMembership(profile?.id)

  const { data: next } = useAsync(async () => {
    const now = new Date()
    const to = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)
    const { data } = await supabase.rpc('get_sessions', { p_from: now.toISOString(), p_to: to.toISOString() })
    return ((data as SessionRow[]) ?? []).filter((s) => s.my_status === 'booked' || s.my_status === 'waitlist').slice(0, 2)
  }, [profile?.id])

  const { data: occupancy } = useAsync(async () => {
    const { data } = await supabase.rpc('gym_occupancy')
    return data as { now: number; capacity: number; by_hour: { h: number; n: number }[] } | null
  })

  const { data: news } = useAsync(async () => {
    const { data } = await supabase.from('announcements').select('*').order('is_pinned', { ascending: false }).order('published_at', { ascending: false }).limit(3)
    return (data as Announcement[]) ?? []
  })

  const { data: cert } = useAsync(async () => {
    if (!profile) return null
    const { data } = await supabase.from('medical_certificates').select('*').eq('user_id', profile.id).order('expires_on', { ascending: false }).limit(1).maybeSingle()
    return data as Certificate | null
  }, [profile?.id])

  const active = membership && membership.status === 'active' && (!membership.end_date || (daysUntil(membership.end_date) ?? 0) >= 0)
  const left = daysUntil(membership?.end_date)
  const total = membership?.end_date ? Math.max(1, (new Date(membership.end_date).getTime() - new Date(membership.start_date).getTime()) / 86400000) : 1
  const certDays = daysUntil(cert?.expires_on)
  const occ = occupancy ? Math.min(1, occupancy.now / Math.max(1, occupancy.capacity)) : 0

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link to="/app/profilo">
          <Avatar p={profile} size={52} ring />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">{greeting()} 👋</div>
          <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="truncate font-display text-3xl uppercase leading-none">
            {profile?.first_name || 'Campione'}
          </motion.div>
        </div>
        <IconButton aria-label="Notifiche" badge={unread} onClick={() => nav('/app/notifiche')}>
          <Bell className="size-5" />
        </IconButton>
      </div>

      {/* Avvisi */}
      {cert === null || (certDays !== null && certDays < 15) ? (
        <motion.button initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} onClick={() => nav('/app/profilo#certificato')} className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-danger/40 bg-danger/10 p-3 text-left">
          <AlertTriangle className="size-5 shrink-0 text-danger" />
          <span className="flex-1 text-sm">
            {cert === null ? 'Carica il certificato medico per poter entrare.' : certDays! < 0 ? 'Il certificato medico è scaduto.' : `Il certificato medico scade tra ${certDays} giorni.`}
          </span>
          <ChevronRight className="size-4 text-danger" />
        </motion.button>
      ) : null}

      {/* Abbonamento */}
      {mLoading ? (
        <Skeleton className="h-40" />
      ) : (
        <motion.div initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 22 }}>
          <Link to="/app/abbonamento" className={`grain relative block overflow-hidden rounded-3xl p-5 ${active ? 'bg-gold text-ink' : 'bg-surface-2 text-cream'}`}>
            <div className="stripes absolute -right-10 -top-10 size-40 rotate-12 opacity-50" />
            <div className="relative flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold uppercase tracking-[0.15em] opacity-70">Il tuo abbonamento</div>
                <div className="mt-1 truncate font-display text-3xl uppercase leading-none">{membership?.plan_name ?? 'Nessun piano'}</div>
                <div className="mt-2 text-sm opacity-80">
                  {!membership
                    ? 'Passa in reception per attivarlo'
                    : active
                      ? membership.end_date
                        ? `Valido fino al ${fmtDate(membership.end_date, 'd MMMM')}`
                        : 'Attivo'
                      : 'Scaduto: rinnovalo in reception'}
                </div>
                {membership?.entries_left != null && <Badge className="mt-3 !bg-ink !text-gold">{membership.entries_left} ingressi rimasti</Badge>}
              </div>
              {active && left !== null && (
                <Ring value={left / total} size={88} stroke={9} color="#060E1C">
                  <div className="text-center">
                    <div className="font-display text-3xl leading-none">{left}</div>
                    <div className="text-[10px] font-bold uppercase">giorni</div>
                  </div>
                </Ring>
              )}
            </div>
          </Link>
        </motion.div>
      )}

      {/* Affluenza */}
      <Card initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-success" />
            </span>
            <span className="label">Affluenza ora</span>
          </div>
          <span className="text-sm font-semibold">{occ < 0.35 ? 'Tranquilla' : occ < 0.7 ? 'Media' : 'Piena'}</span>
        </div>
        <div className="mt-3 flex items-end gap-1 h-14">
          {(occupancy?.by_hour ?? []).map((b) => {
            const max = Math.max(1, ...(occupancy?.by_hour ?? []).map((x) => x.n))
            const isNow = b.h === new Date().getHours()
            return (
              <motion.div key={b.h} className={`flex-1 rounded-t-md ${isNow ? 'bg-gold' : 'bg-navy-bright/50'}`} initial={{ height: 0 }} animate={{ height: `${Math.max(6, (b.n / max) * 100)}%` }} transition={{ delay: 0.2 + b.h * 0.02, type: 'spring', stiffness: 120 }} title={`${b.h}:00`} />
            )
          })}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted">
          <span>6:00</span>
          <span>14:00</span>
          <span>22:00</span>
        </div>
      </Card>

      {/* Prossime lezioni */}
      <SectionTitle action={<Link to="/app/calendario" className="text-xs font-semibold text-gold">Calendario</Link>}>Prossime lezioni</SectionTitle>
      {next && next.length > 0 ? (
        <div className="space-y-3">
          {next.map((s, i) => (
            <motion.div key={s.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}>
              <Link to="/app/calendario" className="card flex items-center gap-4 p-4">
                <div className="grid w-14 shrink-0 place-items-center rounded-xl bg-night py-2">
                  <div className="font-display text-2xl leading-none">{fmtTime(s.starts_at)}</div>
                  <div className="text-[10px] uppercase text-muted">{fmtDate(s.starts_at, 'EEE d')}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{s.title}</div>
                  <div className="text-xs text-muted">{s.trainer_name ?? 'Staff OldSchool'}</div>
                </div>
                <Badge tone={s.my_status === 'booked' ? 'green' : 'gold'}>{s.my_status === 'booked' ? 'Prenotato' : 'In attesa'}</Badge>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <Link to="/app/calendario" className="card flex items-center gap-4 p-4">
          <div className="grid size-12 place-items-center rounded-xl bg-gold/15 text-gold">
            <CalendarPlus className="size-6" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">Nessuna lezione prenotata</div>
            <div className="text-xs text-muted">Scegli un corso e prenota il tuo posto</div>
          </div>
          <ChevronRight className="size-5 text-muted" />
        </Link>
      )}

      {/* Azioni rapide */}
      <SectionTitle>Scorciatoie</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        {[
          { to: '/app/allenamento', icon: Dumbbell, label: 'Scheda', tone: 'bg-navy-bright text-white' },
          { to: '/app/allenamento?tab=progressi', icon: LineChart, label: 'Progressi', tone: 'bg-cream text-ink' },
          { to: '/app/messaggi', icon: MessageCircle, label: 'Trainer', tone: 'bg-surface-2 text-cream' },
          { to: '/app/news', icon: Newspaper, label: 'News', tone: 'bg-surface-2 text-cream' },
          { to: '/app/invita', icon: Gift, label: 'Invita', tone: 'bg-gold text-ink' },
          { to: '/app/personal', icon: Users, label: 'Personal', tone: 'bg-surface-2 text-cream' },
        ].map((a, i) => (
          <motion.div key={a.to} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * i }} whileTap={{ scale: 0.94 }}>
            <Link to={a.to} className={`flex aspect-square flex-col justify-between rounded-2xl p-3 ${a.tone}`}>
              <a.icon className="size-6" />
              <span className="text-sm font-bold">{a.label}</span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* News */}
      <SectionTitle action={<Link to="/app/news" className="text-xs font-semibold text-gold">Tutte</Link>}>Bacheca</SectionTitle>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {(news ?? []).map((n) => (
          <Link key={n.id} to="/app/news" className="card w-64 shrink-0 snap-start overflow-hidden p-0">
            <PhotoPlaceholder label={n.category} className="aspect-[16/9]" />
            <div className="p-3">
              <Badge tone="gold">{n.category}</Badge>
              <div className="mt-2 line-clamp-2 font-semibold">{n.title}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
