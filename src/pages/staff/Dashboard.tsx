import { PushBanner } from '../../components/PushCard'
import PendingSignups from '../../components/PendingSignups'
import { AlertTriangle, Bell, CalendarClock, ChevronRight, FileWarning } from 'lucide-react'
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
  const { profile, isFront, isAdmin } = useAuth()
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
      <PushBanner />
      <div className="mb-5 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {profile?.first_name && <div className="text-xs text-muted">{greeting()}</div>}
          <h1 className="truncate text-lg font-semibold leading-tight">{profile?.first_name || greeting()}</h1>
        </div>
        <IconButton aria-label="Notifiche" badge={unread} onClick={() => nav('/app/notifiche')}>
          <Bell className="size-5" />
        </IconButton>
        <Link to="/app" className="hidden rounded-xl bg-white/5 px-3 py-2 text-xs font-semibold text-muted hover:text-cream sm:block">
          Vista cliente
        </Link>
      </div>

      {isAdmin && <PendingSignups />}

      {loading || !d ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat tone="gold" label="In sala ora" value={d.in_gym_now} sub={`${d.checkins_today} ingressi oggi`} onClick={() => nav('/staff/checkin')} />
            <Stat label="Iscritti attivi" value={d.active_members} sub={`su ${d.total_clients} clienti`} onClick={() => nav('/staff/clienti')} />
            {isFront ? (
              <Stat label="Incassi mese" value={euro(d.revenue_month_cents ?? 0)} sub={d.pending_payments_cents ? `${euro(d.pending_payments_cents)} da incassare` : 'Nessun sospeso'} onClick={() => nav('/staff/statistiche')} />
            ) : (
              <Stat label="Lezioni oggi" value={d.today_sessions.length} />
            )}
            <Stat label="Richieste di prova" value={d.new_leads} sub="Dal sito" onClick={() => nav('/staff/lead')} />
          </div>

          {/* Da controllare: solo le voci che hanno qualcosa */}
          {(() => {
            const alerts = [
              { n: d.expiring_7d, t: 'abbonamenti scadono entro 7 giorni', icon: CalendarClock, to: '/staff/clienti?filtro=scadenza' },
              { n: d.certs_expiring_30d, t: 'certificati scadono entro 30 giorni', icon: FileWarning, to: '/staff/clienti?filtro=certificato' },
              { n: d.at_risk, t: 'clienti non vengono da un po\'', icon: AlertTriangle, to: '/staff/statistiche' },
            ].filter((a) => a.n > 0)
            if (alerts.length === 0) return null
            return (
              <div className="card mt-3 divide-y divide-line/50 p-0">
                {alerts.map((a) => (
                  <Link key={a.t} to={a.to} className="flex items-center gap-3 p-3">
                    <a.icon className="size-[18px] shrink-0 text-gold" strokeWidth={1.75} />
                    <span className="w-6 text-right font-semibold tabular-nums">{a.n}</span>
                    <span className="flex-1 text-sm text-cream/80">{a.t}</span>
                    <ChevronRight className="size-4 text-muted" />
                  </Link>
                ))}
              </div>
            )
          })()}

          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <div>
              <SectionTitle action={<Link to="/staff/calendario" className="text-xs font-semibold text-gold">Gestisci</Link>}>Lezioni di oggi</SectionTitle>
              {d.today_sessions.length === 0 ? (
                <p className="card p-4 text-sm text-muted">Nessuna lezione oggi</p>
              ) : (
                <div className="card divide-y divide-line/50 p-0">
                  {d.today_sessions.map((s) => {
                    const pct = s.booked / Math.max(1, s.capacity)
                    return (
                      <Link key={s.id} to={`/staff/calendario?sessione=${s.id}`} className="flex items-center gap-3 p-3">
                        <div className="w-12 font-semibold tabular-nums">{fmtTime(s.starts_at)}</div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{s.title}</div>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
                            <div className={`h-full ${pct >= 1 ? 'bg-danger' : 'bg-gold'}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
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
                {d.checkins_week.some((w) => w.n > 0) ? (
                  <Suspense fallback={<Skeleton className="h-48" />}>
                    <Charts kind="bar" data={d.checkins_week.map((w) => ({ x: fmtDate(w.day, 'EEE'), y: w.n }))} />
                  </Suspense>
                ) : (
                  <p className="p-1 text-sm text-muted">Ancora nessun ingresso questa settimana</p>
                )}
              </Card>
            </div>
          </div>
        </>
      )}

      <SectionTitle action={<Link to="/staff/checkin" className="text-xs font-semibold text-gold">Scanner</Link>}>Ultimi ingressi</SectionTitle>
      <div className="card divide-y divide-line/50 p-0">
        {(recent ?? []).length === 0 && <p className="p-4 text-sm text-muted">Ancora nessun ingresso registrato</p>}
        {(recent ?? []).map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3">
            <Avatar p={c.profiles} size={32} />
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
