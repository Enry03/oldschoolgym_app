import { AnimatePresence, motion, type HTMLMotionProps } from 'framer-motion'
import clsx from 'clsx'
import { Camera, ChevronLeft, Loader2, X } from 'lucide-react'
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import logo from '../assets/logo.webp'
import { initials } from '../lib/format'
import { publicUrl } from '../lib/supabase'

/* ---------- Button ---------- */
type Variant = 'gold' | 'navy' | 'ghost' | 'outline' | 'danger' | 'cream'
const variants: Record<Variant, string> = {
  gold: 'bg-gold text-ink hover:bg-gold-soft shadow-[0_8px_30px_-8px_rgba(245,197,24,0.6)]',
  navy: 'bg-navy-bright text-white hover:brightness-110',
  cream: 'bg-cream text-ink hover:bg-white',
  ghost: 'bg-white/5 text-cream hover:bg-white/10',
  outline: 'border border-line text-cream hover:border-gold/60 hover:text-gold',
  danger: 'bg-danger/15 text-danger hover:bg-danger/25',
}

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: ReactNode
  block?: boolean
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'gold', size = 'md', loading, icon, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={clsx(
        'relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none',
        size === 'sm' && 'h-9 px-3 text-sm',
        size === 'md' && 'h-11 px-4 text-[15px]',
        size === 'lg' && 'h-14 px-6 text-base',
        block && 'w-full',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  )
})

export function IconButton({ className, children, badge, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { badge?: number }) {
  return (
    <button
      className={clsx(
        'relative grid size-11 place-items-center rounded-full bg-white/5 text-cream transition hover:bg-white/10 active:scale-95',
        className,
      )}
      {...rest}
    >
      {children}
      {!!badge && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-5 h-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white ring-2 ring-ink">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </button>
  )
}

/* ---------- Card ---------- */
export function Card({ className, children, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <motion.div className={clsx('card p-4', className)} {...rest}>
      {children}
    </motion.div>
  )
}

/* ---------- Form ---------- */
const fieldCls =
  'w-full rounded-xl border border-line bg-night/80 px-3.5 py-3 text-cream placeholder:text-muted/60 outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20'

export function Field({ label, hint, error, children }: { label?: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="label block">{label}</span>}
      {children}
      {hint && !error && <span className="block text-xs text-muted">{hint}</span>}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={clsx(fieldCls, className)} {...rest} />
})

export function Textarea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(fieldCls, 'min-h-24 resize-y', className)} {...rest} />
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={clsx(fieldCls, 'appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10', className)} style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394A0B4' stroke-width='2'><path d='m6 9 6 6 6-6'/></svg>\")" }} {...rest}>
      {children}
    </select>
  )
}

export function Toggle({ checked, onChange, label, desc }: { checked: boolean; onChange: (v: boolean) => void; label: string; desc?: string }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center gap-3 py-2 text-left">
      <span className="flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {desc && <span className="block text-xs text-muted">{desc}</span>}
      </span>
      <span className={clsx('relative h-7 w-12 shrink-0 rounded-full transition-colors', checked ? 'bg-gold' : 'bg-line')}>
        <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className={clsx('absolute top-1 size-5 rounded-full bg-white shadow', checked ? 'right-1' : 'left-1')} />
      </span>
    </button>
  )
}

/* ---------- Badge ---------- */
const badgeTones = {
  gold: 'bg-gold/15 text-gold',
  green: 'bg-success/15 text-success',
  red: 'bg-danger/15 text-danger',
  blue: 'bg-info/15 text-info',
  gray: 'bg-white/8 text-muted',
}
export function Badge({ tone = 'gray', children, className }: { tone?: keyof typeof badgeTones; children: ReactNode; className?: string }) {
  return <span className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold', badgeTones[tone], className)}>{children}</span>
}

/* ---------- Avatar ---------- */
export function Avatar({ p, size = 44, ring }: { p?: { first_name?: string | null; last_name?: string | null; avatar_url?: string | null } | null; size?: number; ring?: boolean }) {
  const url = publicUrl('avatars', p?.avatar_url)
  return (
    <span
      className={clsx('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-navy-bright to-navy font-varsity text-cream', ring && 'ring-2 ring-gold ring-offset-2 ring-offset-ink')}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" loading="lazy" /> : initials(p)}
    </span>
  )
}

/* ---------- Logo ---------- */
export function Logo({ size = 56, className }: { size?: number; className?: string }) {
  return <img src={logo} alt="OldSchool Gym" width={size} height={size} className={clsx('select-none drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)]', className)} style={{ width: size, height: 'auto' }} />
}

/* ---------- Segnaposto foto ---------- */
export function PhotoPlaceholder({ label = 'Foto in arrivo', className, tone = 'navy' }: { label?: string; className?: string; tone?: 'navy' | 'gold' | 'dark' }) {
  return (
    <div
      className={clsx(
        'grain relative flex flex-col items-center justify-center gap-2 overflow-hidden text-center',
        tone === 'navy' && 'bg-gradient-to-br from-navy via-surface-2 to-ink',
        tone === 'gold' && 'bg-gradient-to-br from-gold-deep via-gold to-gold-soft text-ink',
        tone === 'dark' && 'bg-gradient-to-br from-surface to-ink',
        className,
      )}
    >
      <div className="stripes absolute inset-0 opacity-40" />
      <Camera className={clsx('relative size-7', tone === 'gold' ? 'text-ink/60' : 'text-gold/70')} />
      <span className={clsx('relative font-varsity text-[11px] uppercase tracking-widest', tone === 'gold' ? 'text-ink/70' : 'text-cream/60')}>{label}</span>
    </div>
  )
}

/* ---------- Header pagina ---------- */
export function PageHeader({ title, subtitle, back, right, kicker }: { title: string; subtitle?: string; back?: boolean | string; right?: ReactNode; kicker?: string }) {
  const nav = useNavigate()
  return (
    <div className="mb-5 flex items-end gap-3">
      {back && (
        <IconButton aria-label="Indietro" onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))} className="mb-0.5 shrink-0">
          <ChevronLeft className="size-5" />
        </IconButton>
      )}
      <div className="min-w-0 flex-1">
        {kicker && <div className="label mb-1 text-gold">{kicker}</div>}
        <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="truncate font-display text-[32px] uppercase leading-none tracking-wide">
          {title}
        </motion.h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between">
      <h2 className="font-display text-xl uppercase tracking-wide">{children}</h2>
      {action}
    </div>
  )
}

/* ---------- Stat ---------- */
export function Stat({ label, value, sub, tone = 'surface', icon, onClick }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'surface' | 'gold' | 'navy' | 'cream'; icon?: ReactNode; onClick?: () => void }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      className={clsx(
        'relative overflow-hidden rounded-2xl p-4 text-left',
        tone === 'surface' && 'card',
        tone === 'gold' && 'bg-gold text-ink',
        tone === 'navy' && 'bg-navy-bright text-white',
        tone === 'cream' && 'bg-cream text-ink',
        !onClick && 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={clsx('text-[11px] font-semibold uppercase tracking-[0.12em]', tone === 'surface' ? 'text-muted' : 'opacity-70')}>{label}</span>
        {icon && <span className="opacity-70">{icon}</span>}
      </div>
      <div className="mt-2 font-display text-4xl leading-none">{value}</div>
      {sub && <div className={clsx('mt-1.5 text-xs', tone === 'surface' ? 'text-muted' : 'opacity-75')}>{sub}</div>}
    </motion.button>
  )
}

/* ---------- Tabs segmentate ---------- */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={clsx('no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-night p-1', className)}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={clsx('relative shrink-0 flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors', value === o.value ? 'text-ink' : 'text-muted hover:text-cream')}>
          {value === o.value && <motion.span layoutId={`seg-${options.map((x) => x.value).join('')}`} className="absolute inset-0 rounded-xl bg-gold" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

/* ---------- Chips ---------- */
export function Chips<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={clsx('shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition', value === o.value ? 'border-gold bg-gold text-ink' : 'border-line text-cream/80 hover:border-gold/50')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Bottom sheet / modal ---------- */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title?: string; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => info.offset.y > 120 && onClose()}
            className="relative flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-3xl border-t border-line bg-night sm:rounded-3xl sm:border"
          >
            <div className="mx-auto mt-2.5 h-1.5 w-12 rounded-full bg-line sm:hidden" />
            <div className="flex items-center justify-between px-5 pb-2 pt-3">
              <h3 className="font-display text-2xl uppercase tracking-wide">{title}</h3>
              <IconButton aria-label="Chiudi" onClick={onClose} className="size-9">
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4" onPointerDownCapture={(e) => e.stopPropagation()}>
              {children}
            </div>
            {footer && <div className="safe-bottom border-t border-line/60 px-5 pt-3">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---------- Stati vuoti / caricamento ---------- */
export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      {icon && <div className="mb-1 grid size-14 place-items-center rounded-2xl bg-gold/10 text-gold">{icon}</div>}
      <div className="font-display text-xl uppercase tracking-wide">{title}</div>
      {text && <p className="max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </motion.div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded-2xl bg-surface/70', className)} />
}

export function Loading({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-20" />
      ))}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="grid min-h-[60dvh] place-items-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.2, ease: 'linear' }}>
        <Logo size={72} />
      </motion.div>
    </div>
  )
}

/* ---------- Anello di progresso ---------- */
export function Ring({ value, size = 76, stroke = 8, color = 'var(--color-gold)', children }: { value: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        <motion.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

/* ---------- Lista animata ---------- */
export const listItem = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: Math.min(i, 10) * 0.045, type: 'spring' as const, stiffness: 300, damping: 30 } }),
}
