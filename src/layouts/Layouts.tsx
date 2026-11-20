import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Clock3, FileCheck2, RefreshCw, ShieldX, Dumbbell, Home, LayoutDashboard, LogOut, Menu, ScanLine, User, Users } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, Logo, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { errMsg, supabase } from '../lib/supabase'
import { fullName, roleLabel } from '../lib/format'

export function PageTransition({ children }: { children: ReactNode }) {
  const loc = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={loc.pathname}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

interface NavItem {
  to: string
  label: string
  icon: typeof Home
  end?: boolean
}

function BottomNav({ items, center }: { items: NavItem[]; center: { to: string; icon: typeof Home; label: string } }) {
  const left = items.slice(0, 2)
  const right = items.slice(2)
  const C = center.icon
  const Item = ({ it }: { it: NavItem }) => (
    <NavLink to={it.to} end={it.end} className="relative flex flex-1 flex-col items-center gap-1 py-2">
      {({ isActive }) => (
        <>
          {isActive && <motion.span layoutId="nav-pill" className="absolute top-0 h-1 w-8 rounded-full bg-gold" transition={{ type: 'spring', stiffness: 500, damping: 35 }} />}
          <it.icon className={clsx('size-[22px] transition-colors', isActive ? 'text-gold' : 'text-muted')} strokeWidth={isActive ? 2.4 : 2} />
          <span className={clsx('text-[10.5px] font-semibold transition-colors', isActive ? 'text-cream' : 'text-muted')}>{it.label}</span>
        </>
      )}
    </NavLink>
  )
  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-line/50 bg-ink/85 backdrop-blur-xl md:hidden">
      <div className="mx-auto flex max-w-lg items-end px-2">
        {left.map((it) => (
          <Item key={it.to} it={it} />
        ))}
        <div className="flex flex-1 justify-center">
          <NavLink to={center.to} aria-label={center.label} className="-mt-7 grid size-16 place-items-center rounded-full bg-gold text-ink shadow-[0_10px_30px_-6px_rgba(245,197,24,0.7)] ring-4 ring-ink transition active:scale-95">
            <C className="size-7" strokeWidth={2.3} />
          </NavLink>
        </div>
        {right.map((it) => (
          <Item key={it.to} it={it} />
        ))}
      </div>
    </nav>
  )
}

function SideNav({ items, extra }: { items: NavItem[]; extra?: NavItem[] }) {
  const { profile, signOut } = useAuth()
  const nav = useNavigate()
  const all = [...items, ...(extra ?? [])]
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line/50 bg-night/60 p-5 md:flex">
      <div className="mb-8 flex items-center gap-3">
        <Logo size={52} />
        <div>
          <div className="font-varsity text-lg leading-none text-cream">OldSchool</div>
          <div className="text-xs text-gold">Gym · Pineto</div>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto">
        {all.map((it) => (
          <NavLink key={it.to} to={it.to} end={it.end} className={({ isActive }) => clsx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', isActive ? 'bg-gold text-ink' : 'text-cream/80 hover:bg-white/5')}>
            <it.icon className="size-[18px]" />
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-surface/60 p-3">
        <Avatar p={profile} size={38} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">{fullName(profile)}</div>
          <div className="text-xs text-muted">{roleLabel[profile?.role ?? 'client']}</div>
        </div>
        <button
          aria-label="Esci"
          className="text-muted hover:text-danger"
          onClick={async () => {
            await signOut()
            nav('/')
          }}
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </aside>
  )
}

export function RequireAuth({ staff }: { staff?: boolean }) {
  const { session, profile, loading, isStaff, settings } = useAuth()
  const loc = useLocation()
  if (loading || (session && !profile)) return <Spinner />
  if (!session) return <Navigate to="/accedi" replace state={{ from: loc.pathname }} />
  if (staff && !isStaff) return <Navigate to="/app" replace />
  // Prima il regolamento (anche in attesa: chi è iscritto dalla reception lo accetta al primo accesso), poi l'approvazione
  if (profile && profile.role === 'client' && profile.approval_status !== 'rejected' && settings && (profile.rules_version !== settings.rules_version || profile.privacy_version !== settings.privacy_version || !profile.consent_health)) return <AcceptRules />
  if (profile && profile.approval_status !== 'approved') return <PendingApproval />
  if (profile && !profile.is_active) {
    return (
      <div className="grid min-h-dvh place-items-center p-8 text-center">
        <div>
          <Logo size={90} className="mx-auto mb-6" />
          <h1 className="font-display text-3xl uppercase">Account sospeso</h1>
          <p className="mt-2 text-muted">Contatta la reception per riattivarlo.</p>
        </div>
      </div>
    )
  }
  return <Outlet />
}

// Regolamento nuovo (o mai accettato, per chi è stato iscritto dalla reception): va accettato per continuare.
// La registrazione dell'accettazione passa da accept_rules, che controlla la versione nel database.
function AcceptRules() {
  const { profile, settings, refreshProfile, signOut } = useAuth()
  const nav = useNavigate()
  const [rules, setRules] = useState(false)
  const [health, setHealth] = useState(!!profile?.consent_health)
  const [privacy, setPrivacy] = useState(false)
  const [busy, setBusy] = useState(false)
  const updated = profile?.rules_version != null
  const needPrivacy = profile?.privacy_version !== settings?.privacy_version
  async function accept() {
    if (!rules || !health || (needPrivacy && !privacy)) return toast.error('Servono tutte le conferme per continuare')
    setBusy(true)
    const { error } = await supabase.rpc('accept_rules', { p_version: settings!.rules_version, p_health: true, p_privacy: settings!.privacy_version })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    await refreshProfile()
    toast.success('Grazie, buon allenamento! 💪')
  }
  return (
    <div className="grid min-h-dvh place-items-center p-6">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-gold/15 text-gold">
          <FileCheck2 className="size-7" />
        </div>
        <h1 className="text-center font-display text-3xl uppercase">{updated ? 'Regolamento aggiornato' : 'Regolamento della palestra'}</h1>
        <p className="mt-2 text-center text-sm text-muted">{updated ? 'Abbiamo aggiornato le regole: leggile e accettale per continuare.' : 'Prima di iniziare leggi e accetta le regole della palestra.'}</p>
        <div className="card mt-5 max-h-[45dvh] space-y-2 overflow-y-auto p-4 text-sm leading-relaxed text-cream/85">
          {(settings?.rules_text ?? '').split(/\n+/).map((r, i) => (
            <p key={i}>{r}</p>
          ))}
        </div>
        <div className="mt-4 space-y-2 text-xs text-cream/80">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#F5C518]" checked={rules} onChange={(e) => setRules(e.target.checked)} />
            <span>Ho letto e accetto il regolamento.</span>
          </label>
          {needPrivacy && (
            <label className="flex items-start gap-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-[#F5C518]" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
              <span>
                Ho letto l'
                <Link to="/privacy" target="_blank" className="text-gold underline">
                  informativa privacy
                </Link>{' '}
                (versione {settings?.privacy_version}) e acconsento al trattamento dei miei dati per la gestione dell'iscrizione.
              </span>
            </label>
          )}
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#F5C518]" checked={health} onChange={(e) => setHealth(e.target.checked)} />
            <span>
              Acconsento al trattamento dei miei dati relativi alla salute (certificato medico sportivo), come spiegato nell'
              <Link to="/privacy" target="_blank" className="text-gold underline">
                informativa privacy
              </Link>
              .
            </span>
          </label>
        </div>
        <button disabled={busy} className="mt-5 w-full rounded-xl bg-gold px-4 py-3 font-semibold text-ink active:scale-95 disabled:opacity-60" onClick={accept}>
          {busy ? 'Salvataggio…' : 'Accetto e continuo'}
        </button>
        <button
          className="mt-2 w-full rounded-xl px-4 py-3 text-sm font-semibold text-muted hover:text-cream"
          onClick={async () => {
            await signOut()
            nav('/')
          }}
        >
          Esci
        </button>
      </motion.div>
    </div>
  )
}

// Schermata per chi si è registrato e aspetta l'ok della palestra (o è stato rifiutato).
// Il blocco vero è nel database: qui si spiega solo cosa succede.
function PendingApproval() {
  const { profile, refreshProfile, signOut, settings } = useAuth()
  const nav = useNavigate()
  const rejected = profile?.approval_status === 'rejected'
  useEffect(() => {
    if (rejected) return
    const t = setInterval(() => void refreshProfile(), 30000)
    const onFocus = () => void refreshProfile()
    window.addEventListener('focus', onFocus)
    return () => {
      clearInterval(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [rejected, refreshProfile])
  const Icon = rejected ? ShieldX : Clock3
  return (
    <div className="grid min-h-dvh place-items-center p-8 text-center">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm">
        <Logo size={90} className="mx-auto mb-6" />
        <div className={clsx('mx-auto mb-4 grid size-14 place-items-center rounded-full', rejected ? 'bg-danger/15 text-danger' : 'bg-gold/15 text-gold')}>
          <Icon className="size-7" />
        </div>
        <h1 className="font-display text-3xl uppercase">{rejected ? 'Iscrizione non approvata' : 'Iscrizione in attesa'}</h1>
        {rejected ? (
          <>
            <p className="mt-2 text-muted">La palestra non ha approvato questa iscrizione.</p>
            {profile?.rejection_reason && <p className="mt-2 text-sm text-cream/80">Motivo: {profile.rejection_reason}</p>}
            <p className="mt-2 text-muted">Per chiarimenti passa in reception{settings?.phone ? ` o chiama il ${settings.phone}` : ''}.</p>
          </>
        ) : (
          <>
            <p className="mt-2 text-muted">
              Ciao {profile?.first_name || 'campione'}, abbiamo ricevuto la tua richiesta. La palestra deve approvarla prima che tu possa usare l'app: prenotazioni, schede e ingresso si sbloccano subito dopo.
            </p>
            <p className="mt-2 text-sm text-muted">
              Passa in reception con un documento: ti scattiamo la foto per l'ingresso e approviamo l'iscrizione.
              {profile?.guardian_name ? ' Porta con te un genitore per firmare il modulo di consenso.' : ''}
            </p>
          </>
        )}
        <div className="mt-6 flex flex-col gap-2">
          {!rejected && (
            <button className="flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 font-semibold text-ink active:scale-95" onClick={() => void refreshProfile()}>
              <RefreshCw className="size-4" /> Controlla di nuovo
            </button>
          )}
          <button
            className="rounded-xl px-4 py-3 text-sm font-semibold text-muted hover:text-cream"
            onClick={async () => {
              await signOut()
              nav('/')
            }}
          >
            Esci
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const clientItems: NavItem[] = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/app/allenamento', label: 'Allenamento', icon: Dumbbell },
  { to: '/app/profilo', label: 'Profilo', icon: User },
]

export function ClientLayout() {
  const { isStaff } = useAuth()
  return (
    <div className="relative mx-auto min-h-dvh max-w-lg">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(43,91,168,0.35),transparent_70%)]" />
      <main className="safe-top relative z-10 px-4 pb-32 pt-4">
        {isStaff && (
          <NavLink to="/staff" className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-gold/10 py-2 text-xs font-semibold text-gold">
            <LayoutDashboard className="size-3.5" /> Torna al pannello staff
          </NavLink>
        )}
        <PageTransition>
          <Outlet />
        </PageTransition>
      </main>
      <BottomNav items={clientItems} center={{ to: '/app/entra', icon: ScanLine, label: 'Entra in palestra' }} />
    </div>
  )
}

const staffItems: NavItem[] = [
  { to: '/staff', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/staff/clienti', label: 'Clienti', icon: Users },
  { to: '/staff/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/staff/altro', label: 'Altro', icon: Menu },
]

export function StaffLayout() {
  const { isFront } = useAuth()
  const extra: NavItem[] = [
    { to: '/staff/checkin', label: 'Check-in QR', icon: ScanLine },
    { to: '/staff/schede', label: 'Schede ed esercizi', icon: Dumbbell },
    ...(isFront ? [{ to: '/staff/comunicazioni', label: 'Comunicazioni', icon: Menu }] : []),
  ]
  return (
    <div className="flex min-h-dvh">
      <SideNav items={staffItems} extra={extra} />
      <div className="relative min-w-0 flex-1">
        <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(245,197,24,0.10),transparent_70%)]" />
        <main className="safe-top relative z-10 mx-auto max-w-5xl px-4 pb-32 pt-4 md:px-8 md:pb-12 md:pt-8">
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      <BottomNav items={staffItems} center={{ to: '/staff/checkin', icon: ScanLine, label: 'Scanner check-in' }} />
    </div>
  )
}
