import clsx from 'clsx'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Dumbbell, Home, LayoutDashboard, LogOut, Menu, QrCode, ScanLine, User, Users } from 'lucide-react'
import type { ReactNode } from 'react'
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Avatar, Logo, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
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
  const { session, profile, loading, isStaff } = useAuth()
  const loc = useLocation()
  if (loading || (session && !profile)) return <Spinner />
  if (!session) return <Navigate to="/accedi" replace state={{ from: loc.pathname }} />
  if (staff && !isStaff) return <Navigate to="/app" replace />
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
      <BottomNav items={clientItems} center={{ to: '/app/qr', icon: QrCode, label: 'Il mio QR' }} />
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
