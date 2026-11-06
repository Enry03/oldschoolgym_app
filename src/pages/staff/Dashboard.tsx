import { motion } from 'framer-motion'
import { AlertTriangle, Bell, CalendarClock, FileWarning, ScanLine, UserPlus, Users, Wallet } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar, Badge, Card, IconButton, SectionTitle, Skeleton, Stat } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { euro, fmtDate, fmtTime, greeting } from '../../lib/format'
import { useAsync, useNotifications } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'

const Charts = lazy(() => import('../../components/Charts'))

interface Dash {
  active_members: number
  total_clients: number
  checkins_today: number
  in_gym_now: number
  revenue_month_cents: number | null
  pending_payments_cents: number | null
  expiring_7d: number
  certs_expiring_30d: number
  new_leads: number
  at_risk: number
  today_sessions: { id: string; title: string; starts_at: string; capacity: number; booked: number }[]
  checkins_week: { day: string; n: number }[]
}

export default function StaffDashboard() {
  const { profile, isFront } = useAuth()
  const nav = useNavigate()
  const { unread } = useNotifications(profile?.id)
  const { data: d, loading } = useAsync(async () => {
    const { data, error } = await supabase.rpc('admin_dashboard')
    if (error) throw error
    return data as Dash
  })
  const { data: recent } = useAsync(async () => {
    const { data } = await supabase.from('checkins').select('id, checked_at, allowed, reason, profiles!checkins_user_id_fkey(first_name, last_name, avatar_url)').order('checked_at', { ascending: false }).limit(6)
    return (data as unknown as { id: string; checked_at: string; allowed: boolean; reason: string | null; profiles: { first_name: string; last_name: string; avatar_url: string | null } }[]) ?? []
  })

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm text-muted">{greeting()},</div>
          <h1 className="truncate font-display text-4xl uppercase leading-none">{profile?.first_name}</h1>
        </div>
        <IconButton aria-label="Notifiche" badge={unread} onClick={() => nav('/app/notifiche')}>
          <Bell className="size-5" />
        </IconButton>
        <Link to="/app" className="hidden rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-muted hover:text-cream sm:block">
          Vista cliente
        </Link>
      </div>

      {loading || !d ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat tone="gold" label="In sala ora" value={d.in_gym_now} sub={`${d.checkins_today} ingressi oggi`} icon={<ScanLine className="size-4" />} onClick={() => nav('/staff/checkin')} />
            <Stat tone="navy" label="Iscritti attivi" value={d.active_members} sub={`su ${d.total_clients} clienti`} icon={<Users className="size-4" />} onClick={() => nav('/staff/clienti')} />
            {isFront ? (
              <Stat label="Incassi mese" value={euro(d.revenue_month_cents ?? 0)} sub={d.pending_payments_cents ? `${euro(d.pending_payments_cents)} da incassare` : 'Nessun sospeso'} icon={<Wallet className="size-4" />} onClick={() => nav('/staff/statistiche')} />
            ) : (
              <Stat label="Lezioni oggi" value={d.today_sessions.length} icon={<CalendarClock className="size-4" />} />
            )}
            <Stat tone="cream" label="Nuovi lead" value={d.new_leads} sub="Richieste di prova" icon={<UserPlus className="size-4" />} onClick={() => nav('/staff/lead')} />
          </div>

          {/* Alert */}
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { n: d.expiring_7d, t: 'abbonamenti scadono entro 7 giorni', icon: CalendarClock, to: '/staff/clienti?filtro=scadenza', tone: 'text-gold bg-gold/10 border-gold/30' },
              { n: d.certs_expiring_30d, t: 'certificati in scadenza (30 gg)', icon: FileWarning, to: '/staff/clienti?filtro=certificato', tone: 'text-info bg-info/10 border-info/30' },
              { n: d.at_risk, t: 'clienti a rischio abbandono', icon: AlertTriangle, to: '/staff/statistiche', tone: 'text-danger bg-danger/10 border-danger/30' },
            ].map((a, i) => (
              <motion.div key={a.t} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: 0.1 + i * 0.05 } }}>
                <Link to={a.to} className={`flex items-center gap-3 rounded-2xl border p-3 ${a.tone}`}>
                  <a.icon className="size-5 shrink-0" />
                  <span className="font-display text-2xl leading-none">{a.n}</span>
                  <span className="text-xs text-cream/80">{a.t}</span>
                </Link>
              </motion.div>
            ))}
          </div>

          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <div>
              <SectionTitle action={<Link to="/staff/calendario" className="text-xs font-semibold text-gold">Gestisci</Link>}>Lezioni di oggi</SectionTitle>
              {d.today_sessions.length === 0 ? (
                <p className="card p-4 text-sm text-muted">Nessuna lezione oggi.</p>
              ) : (
                <div className="space-y-2">
                  {d.today_sessions.map((s) => {
                    const pct = s.booked / Math.max(1, s.capacity)
                    return (
                      <Link key={s.id} to={`/staff/calendario?sessione=${s.id}`} className="card flex items-center gap-3 p-3">
                        <div className="w-12 font-display text-xl">{fmtTime(s.starts_at)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{s.title}</div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <motion.div className={`h-full ${pct >= 1 ? 'bg-danger' : 'bg-gold'}`} initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct * 100)}%` }} />
                          </div>
                        </div>
                        <Badge tone={pct >= 1 ? 'red' : 'gray'}>
                          {s.booked}/{s.capacity}
                        </Badge>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
            <div>
              <SectionTitle>Ingressi ultimi 7 giorni</SectionTitle>
              <Card className="p-3">
                <Suspense fallback={<Skeleton className="h-48" />}>
                  <Charts kind="bar" data={d.checkins_week.map((w) => ({ x: fmtDate(w.day, 'EEE'), y: w.n }))} />
                </Suspense>
              </Card>
            </div>
          </div>
        </>
      )}

      <SectionTitle action={<Link to="/staff/checkin" className="text-xs font-semibold text-gold">Scanner</Link>}>Ultimi ingressi</SectionTitle>
      <div className="space-y-2">
        {(recent ?? []).length === 0 && <p className="card p-4 text-sm text-muted">Ancora nessun ingresso registrato.</p>}
        {(recent ?? []).map((c) => (
          <div key={c.id} className="card flex items-center gap-3 p-3">
            <Avatar p={c.profiles} size={38} />
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {c.profiles?.first_name} {c.profiles?.last_name}
              </div>
              <div className="text-xs text-muted">{c.allowed ? 'Ingresso consentito' : c.reason}</div>
            </div>
            <span className="text-xs text-muted">{fmtTime(c.checked_at)}</span>
            <span className={`size-2.5 rounded-full ${c.allowed ? 'bg-success' : 'bg-danger'}`} />
          </div>
        ))}
      </div>
    </div>
  )
}
