import { PushBanner } from '../../components/PushCard'
import { AlertTriangle, Bell, CalendarPlus, ChevronRight, Dumbbell, Gift, LineChart, MessageCircle, Newspaper, Users } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Badge, IconButton, Ring, SectionTitle, Skeleton } from '../../components/ui'
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
      <div className="mb-5 flex items-center gap-3">
        <Link to="/app/profilo" aria-label="Profilo">
          <Avatar p={profile} size={44} />
        </Link>
        <div className="min-w-0 flex-1">
          {profile?.first_name && <div className="text-xs text-muted">{greeting()}</div>}
          <div className="truncate text-lg font-semibold leading-tight">{profile?.first_name || greeting()}</div>
        </div>
        <IconButton aria-label="Notifiche" badge={unread} onClick={() => nav('/app/notifiche')}>
          <Bell className="size-5" />
        </IconButton>
      </div>

      {/* Avvisi */}
      <PushBanner />
      {cert === null || (certDays !== null && certDays < 15) ? (
        <button onClick={() => nav('/app/profilo#certificato')} className="mb-3 flex w-full items-center gap-3 rounded-xl border border-danger/40 bg-danger/10 p-3 text-left">
          <AlertTriangle className="size-[18px] shrink-0 text-danger" />
          <span className="flex-1 text-sm">
            {cert === null ? 'Carica il certificato medico per poter entrare' : certDays! < 0 ? 'Il certificato medico è scaduto' : `Il certificato medico scade tra ${certDays} giorni`}
          </span>
          <ChevronRight className="size-4 text-danger" />
        </button>
      ) : null}

      {/* Abbonamento: l'unico elemento colorato della pagina */}
      {mLoading ? (
        <Skeleton className="h-32" />
      ) : (
        <Link to="/app/abbonamento" className={`block rounded-2xl p-4 ${active ? 'bg-gold text-ink' : 'border border-line/50 bg-surface text-cream'}`}>
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium opacity-70">Il tuo abbonamento</div>
              <div className="mt-1 truncate text-xl font-semibold leading-tight">{membership?.plan_name ?? 'Nessun piano attivo'}</div>
              <div className="mt-1 text-sm opacity-75">
                {!membership
                  ? 'Passa in reception per attivarlo'
                  : active
                    ? membership.end_date
                      ? `Valido fino al ${fmtDate(membership.end_date, 'd MMMM')}`
                      : 'Attivo'
                    : 'Scaduto, rinnovalo in reception'}
              </div>
            </div>
            {active && membership?.entries_left != null ? (
              <div className="text-center">
                <div className="font-display text-4xl leading-none tabular-nums">{membership.entries_left}</div>
                <div className="mt-1 text-[11px] font-medium opacity-70">ingressi</div>
              </div>
            ) : (
              active &&
              left !== null && (
                <Ring value={left / total} size={72} stroke={7} color="#060E1C">
                  <div className="text-center">
                    <div className="font-display text-2xl leading-none tabular-nums">{left}</div>
                    <div className="text-[10px] font-medium">giorni</div>
                  </div>
                </Ring>
              )
            )}
          </div>
        </Link>
      )}

      {/* Affluenza: in una palestra da 8 posti basta sapere quanti ci sono ora */}
      {occupancy && (
        <div className="card mt-3 flex items-center gap-3 p-4">
          <span className="size-2 shrink-0 rounded-full bg-success" />
          <span className="flex-1 text-sm">In sala ora</span>
          <span className="text-sm font-semibold tabular-nums">
            {occupancy.now} su {occupancy.capacity}
          </span>
          <span className="text-xs text-muted">{occ < 0.35 ? 'tranquilla' : occ < 0.7 ? 'media' : 'piena'}</span>
        </div>
      )}

      {/* Prossime lezioni */}
      <SectionTitle action={<Link to="/app/calendario" className="text-xs font-medium text-gold">Calendario</Link>}>Prossime lezioni</SectionTitle>
      {next && next.length > 0 ? (
        <div className="card divide-y divide-line/50 p-0">
          {next.map((s) => (
            <Link key={s.id} to="/app/calendario" className="flex items-center gap-3 p-4">
              <div className="w-12 shrink-0 text-center">
                <div className="text-base font-semibold tabular-nums leading-none">{fmtTime(s.starts_at)}</div>
                <div className="mt-1 text-[11px] text-muted">{fmtDate(s.starts_at, 'EEE d')}</div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{s.title}</div>
                <div className="text-xs text-muted">{s.trainer_name ?? 'Staff OldSchool'}</div>
              </div>
              <Badge tone={s.my_status === 'booked' ? 'green' : 'gold'}>{s.my_status === 'booked' ? 'Prenotato' : 'In attesa'}</Badge>
            </Link>
          ))}
        </div>
      ) : (
        <Link to="/app/calendario" className="card flex items-center gap-3 p-4">
          <CalendarPlus className="size-[18px] text-muted" />
          <div className="flex-1 text-sm">Nessuna lezione prenotata</div>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      )}

      {/* Scorciatoie */}
      <SectionTitle>Scorciatoie</SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        {[
          { to: '/app/allenamento', icon: Dumbbell, label: 'Scheda' },
          { to: '/app/allenamento?tab=progressi', icon: LineChart, label: 'Progressi' },
          { to: '/app/messaggi', icon: MessageCircle, label: 'Trainer' },
          { to: '/app/news', icon: Newspaper, label: 'Bacheca' },
          { to: '/app/invita', icon: Gift, label: 'Invita' },
          { to: '/app/personal', icon: Users, label: 'Personal' },
        ].map((a) => (
          <Link key={a.to} to={a.to} className="card flex flex-col items-start gap-3 p-3 transition-colors active:bg-surface-2">
            <a.icon className="size-[18px] text-gold" strokeWidth={1.75} />
            <span className="text-sm font-medium">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Bacheca */}
      {news && news.length > 0 && (
        <>
          <SectionTitle action={<Link to="/app/news" className="text-xs font-medium text-gold">Tutte</Link>}>Bacheca</SectionTitle>
          <div className="card divide-y divide-line/50 p-0">
            {news.map((n) => (
              <Link key={n.id} to="/app/news" className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-muted">{n.category}</div>
                  <div className="truncate font-medium">{n.title}</div>
                </div>
                <ChevronRight className="size-4 text-muted" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
