import { AnimatePresence, m, type HTMLMotionProps } from 'motion/react'
import clsx from 'clsx'
import { Camera, ChevronLeft, Loader2, X } from 'lucide-react'
import { forwardRef, useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import logo from '../assets/logo.webp'
import { initials } from '../lib/format'
import { publicUrl } from '../lib/supabase'

/* ---------- Button ---------- */
type Variant = 'gold' | 'navy' | 'ghost' | 'outline' | 'danger' | 'cream'
const variants: Record<Variant, string> = {
  gold: 'bg-gold text-ink hover:bg-gold-soft',
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
        'relative inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none select-none',
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
    <m.div className={clsx('card p-4', className)} {...rest}>
      {children}
    </m.div>
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
        <m.span layout transition={{ type: 'spring', stiffness: 600, damping: 32 }} className={clsx('absolute top-1 size-5 rounded-full bg-white shadow', checked ? 'right-1' : 'left-1')} />
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
  return <span className={clsx('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium', badgeTones[tone], className)}>{children}</span>
}

/* ---------- Avatar ---------- */
export function Avatar({ p, size = 44, ring }: { p?: { first_name?: string | null; last_name?: string | null; avatar_url?: string | null } | null; size?: number; ring?: boolean }) {
  const url = publicUrl('avatars', p?.avatar_url)
  return (
    <span
      className={clsx('relative inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 font-semibold text-cream', ring && 'ring-2 ring-gold ring-offset-2 ring-offset-ink')}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {url ? <img src={url} alt="" className="size-full object-cover" loading="lazy" /> : initials(p)}
    </span>
  )
}

/* ---------- Logo ---------- */
export function Logo({ size = 56, className }: { size?: number; className?: string }) {
  return <img src={logo} alt="OldSchool Gym" width={size} height={size} className={clsx('select-none', className)} style={{ width: size, height: 'auto' }} />
}

/* ---------- Segnaposto foto ---------- */
export function PhotoPlaceholder({ label = 'Foto in arrivo', className, tone = 'navy' }: { label?: string; className?: string; tone?: 'navy' | 'gold' | 'dark' }) {
  return (
    <div
      className={clsx(
        'relative flex flex-col items-center justify-center gap-2 overflow-hidden text-center',
        tone === 'gold' ? 'bg-gold text-ink' : 'bg-surface-2',
        className,
      )}
    >
      <Camera className={clsx('size-5', tone === 'gold' ? 'text-ink/60' : 'text-muted')} strokeWidth={1.75} />
      <span className={clsx('text-xs', tone === 'gold' ? 'text-ink/70' : 'text-muted')}>{label}</span>
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
        {kicker && <div className="mb-0.5 text-xs font-medium text-gold">{kicker}</div>}
        <h1 className="truncate font-varsity text-[26px] leading-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted">{subtitle}</p>}
      </div>
      {right}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between">
      <h2 className="text-base font-semibold text-cream">{children}</h2>
      {action}
    </div>
  )
}

/* ---------- Stat ---------- */
export function Stat({ label, value, sub, tone = 'surface', onClick }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'surface' | 'gold' | 'navy' | 'cream'; icon?: ReactNode; onClick?: () => void }) {
  return (
    <m.button
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
        <span className={clsx('text-xs font-medium', tone === 'surface' ? 'text-muted' : 'opacity-75')}>{label}</span>
      </div>
      <div className="mt-2 font-display text-3xl leading-none tabular-nums">{value}</div>
      {sub && <div className={clsx('mt-1.5 text-xs', tone === 'surface' ? 'text-muted' : 'opacity-75')}>{sub}</div>}
    </m.button>
  )
}

/* ---------- Tabs segmentate ---------- */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div className={clsx('no-scrollbar flex gap-1 overflow-x-auto rounded-2xl bg-night p-1', className)}>
      {options.map((o) => (
        <button key={o.value} onClick={() => onChange(o.value)} className={clsx('relative shrink-0 flex-1 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors', value === o.value ? 'text-ink' : 'text-muted hover:text-cream')}>
          {value === o.value && <m.span layoutId={`seg-${options.map((x) => x.value).join('')}`} className="absolute inset-0 rounded-xl bg-gold" transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }} />}
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
          className={clsx('shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors', value === o.value ? 'border-gold bg-gold text-ink' : 'border-line text-cream/80 hover:border-gold/50')}
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
  // portal su body: dentro la pagina animata il foglio finiva sotto la barra in basso
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <m.div className="absolute inset-0 bg-black/70" onClick={onClose} />
          <m.div
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
              <h3 className="text-lg font-semibold">{title}</h3>
              <IconButton aria-label="Chiudi" onClick={onClose} className="size-9">
                <X className="size-4" />
              </IconButton>
            </div>
            <div className="flex-1 overflow-y-auto px-5 pb-4" onPointerDownCapture={(e) => e.stopPropagation()}>
              {children}
            </div>
            {footer && <div className="safe-bottom border-t border-line/60 px-5 pt-3">{footer}</div>}
          </m.div>
        </m.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/* ---------- Stati vuoti / caricamento ---------- */
export function Empty({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="card flex flex-col items-center gap-1.5 px-6 py-8 text-center">
      {icon && <div className="mb-1 text-muted [&_svg]:size-6 [&_svg]:stroke-[1.75]">{icon}</div>}
      <div className="text-base font-semibold">{title}</div>
      {text && <p className="max-w-xs text-sm text-muted">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </m.div>
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
      <Loader2 className="size-8 animate-spin text-gold" aria-label="Caricamento" />
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
        <m.circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - v) }} transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }} />
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
