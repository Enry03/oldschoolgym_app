import { m } from 'motion/react'
import { ArrowRight, ClipboardList, Clock, MapPin, MessageCircle, Phone, QrCode, ShieldCheck, Star, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Field, Input, Logo } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { useAsync } from '../../lib/hooks'
import { errMsg, supabase } from '../../lib/supabase'
import type { Course, GymSettings } from '../../lib/types'

// una sola curva per tutta la pagina
const ease = [0.22, 1, 0.36, 1] as const

const STEPS = [
  { i: UserPlus, t: 'Ti iscrivi', d: "Dall'app, in due minuti" },
  { i: ShieldCheck, t: 'Ti approviamo', d: 'Con certificato medico' },
  { i: QrCode, t: 'Entri col QR', d: 'Inquadri il tablet' },
  { i: ClipboardList, t: 'La tua scheda', d: 'Fatta dal trainer, nel telefono' },
]

const DAYS = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato']
const SHORT = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab']

/** Raggruppa i giorni con lo stesso orario: "Lun–Sab 08:30–20:00" */
function groupHours(hours: GymSettings['opening_hours']) {
  const order = [1, 2, 3, 4, 5, 6, 0]
  const rows: { from: number; to: number; text: string }[] = []
  for (const d of order) {
    const h = hours.find((x) => x.day === d)
    const text = h?.open ? `${h.open}–${h.close}` : 'Chiuso'
    const last = rows[rows.length - 1]
    if (last && last.text === text) last.to = d
    else rows.push({ from: d, to: d, text })
  }
  return rows.map((r) => ({ days: r.from === r.to ? DAYS[r.from] : `${SHORT[r.from]}–${SHORT[r.to]}`, text: r.text }))
}

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })

function Stars({ className }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-steel ${className ?? ''}`} aria-hidden>
      <span className="h-px w-8 bg-current" />
      <Star className="size-3 fill-current" />
      <Star className="size-4 fill-gold text-gold" />
      <Star className="size-3 fill-current" />
      <span className="h-px w-8 bg-current" />
    </div>
  )
}

function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mx-auto max-w-xl px-4 pt-12">
      <h2 className="font-varsity text-2xl leading-none text-cream">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function Landing() {
  const { session, settings, isStaff } = useAuth()

  // corsi attivi con il loro orario ricorrente, preso dalla prossima lezione in calendario
  const { data: courses } = useAsync(async () => {
    const [{ data: cs }, { data: ss }] = await Promise.all([
      supabase.from('courses').select('*').eq('is_active', true).order('name'),
      supabase.from('sessions').select('course_id,starts_at,ends_at').eq('is_cancelled', false).gte('starts_at', new Date().toISOString()).order('starts_at').limit(50),
    ])
    return ((cs as Course[]) ?? []).map((c) => {
      const next = (ss ?? []).find((s) => s.course_id === c.id)
      const when = next ? `${DAYS[new Date(next.starts_at).getDay()]} · ${hhmm(next.starts_at)}–${hhmm(next.ends_at)}` : null
      return { ...c, when }
    })
  })

  const appHref = session ? (isStaff ? '/staff' : '/app') : '/registrati'
  const address = settings?.address ?? 'Pineto (TE)'
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`OldSchool Gym ${address}`)}`
  const phone = settings?.phone ?? ''
  const whatsapp = (settings?.whatsapp ?? '').replace(/\D/g, '')

  return (
    <div className="min-h-dvh overflow-x-hidden bg-ink pb-10">
      {/* NAV: solo l'accesso, il logo sta nell'apertura */}
      <header className="safe-top absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex max-w-xl items-center justify-end gap-1 px-4 py-2">
          {!session && (
            <Link to="/accedi" className="rounded-lg px-3 py-2 text-sm font-medium text-cream/80 transition-colors hover:text-gold">
              Accedi
            </Link>
          )}
          <Link to={appHref} className="rounded-lg px-3 py-2 text-sm font-medium text-gold transition-colors hover:text-gold-soft">
            {session ? 'Apri app' : 'Iscriviti'}
          </Link>
        </div>
      </header>

      {/* APERTURA */}
      <section className="relative flex min-h-[100svh] flex-col items-center justify-center px-4 pb-6 pt-12 text-center">
        <m.div
          initial={{ opacity: 0, scale: 1.25, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ duration: 0.5, ease }}
        >
          <Logo size={210} className="max-w-[54vw]" />
        </m.div>
        <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45, duration: 0.4 }}>
          <Stars className="mt-5" />
        </m.div>
        <m.h1
          className="mt-4 font-varsity text-[32px] leading-[1.05] text-cream sm:text-5xl"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55, duration: 0.5, ease }}
        >
          Allenati
          <br />
          come una volta
        </m.h1>
        <m.p
          className="mt-3 max-w-xs text-[15px] text-cream/70"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5, ease }}
        >
          Pochi alla volta, seguiti uno per uno. Ferro, guantoni e niente scorciatoie.
        </m.p>
        <m.div
          className="mt-6 flex w-full max-w-xs flex-col gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.5, ease }}
        >
          <a href="#prova">
            <Button size="lg" block icon={<ArrowRight className="size-5" />}>
              Prova gratis
            </Button>
          </a>
          <Link to={appHref} className="py-1 text-sm font-medium text-cream/70 transition-colors hover:text-gold">
            {session ? "Entra nell'app" : 'Sei già iscritto? Accedi'}
          </Link>
        </m.div>
      </section>

      {/* COME FUNZIONA */}
      <Section title="Come funziona">
        <ol className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1">
          {STEPS.map((s, i) => (
            <li key={s.t} className="w-36 shrink-0 snap-start rounded-xl border border-line/60 bg-surface p-3">
              <div className="flex items-center justify-between text-muted">
                <s.i className="size-[18px] text-gold" strokeWidth={1.75} />
                <span className="text-xs tabular-nums">{i + 1}</span>
              </div>
              <div className="mt-3 text-sm font-semibold text-cream">{s.t}</div>
              <div className="mt-0.5 text-xs leading-snug text-muted">{s.d}</div>
            </li>
          ))}
        </ol>
      </Section>

      {/* CORSI ATTIVI */}
      <Section title="Corsi attivi">
        <ul className="space-y-2">
          {(courses ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-3 rounded-xl border border-line/60 bg-surface p-4">
              <span className="h-10 w-1 shrink-0 rounded-full" style={{ background: c.color || 'var(--color-gold)' }} />
              <div className="min-w-0">
                <div className="font-semibold text-cream">{c.name}</div>
                <div className="text-sm text-gold">{c.when ?? `${c.duration_min} min`}</div>
                {c.description && <div className="mt-1 text-xs text-muted">{c.description}</div>}
              </div>
            </li>
          ))}
          {courses && courses.length === 0 && <li className="text-sm text-muted">Nessun corso in programma al momento</li>}
        </ul>
        <p className="mt-3 text-xs text-muted">Il resto della settimana sala pesi con il trainer, su ingressi</p>
      </Section>

      {/* ORARI E DOVE SIAMO */}
      <Section title="Orari e dove siamo">
        <div className="rounded-xl border border-line/60 bg-surface">
          <div className="flex gap-3 p-4">
            <Clock className="mt-0.5 size-[18px] shrink-0 text-muted" strokeWidth={1.75} />
            <ul className="flex-1 space-y-1 text-sm">
              {settings &&
                groupHours(settings.opening_hours).map((r) => (
                  <li key={r.days} className="flex justify-between gap-3">
                    <span className="text-cream/80">{r.days}</span>
                    <span className={r.text === 'Chiuso' ? 'text-muted' : 'tabular-nums text-cream'}>{r.text}</span>
                  </li>
                ))}
            </ul>
          </div>
          <a href={mapsHref} target="_blank" rel="noreferrer" className="flex items-center gap-3 border-t border-line/60 p-4 text-sm transition-colors hover:text-gold">
            <MapPin className="size-[18px] shrink-0 text-muted" strokeWidth={1.75} />
            <span className="flex-1">{address}</span>
            <span className="text-xs font-medium text-gold">Google Maps</span>
          </a>
          {phone && (
            <div className="flex border-t border-line/60 text-sm">
              <a href={`tel:${phone.replace(/\s/g, '')}`} className="flex flex-1 items-center gap-3 p-4 transition-colors hover:text-gold">
                <Phone className="size-[18px] text-muted" strokeWidth={1.75} /> Chiama
              </a>
              {whatsapp && (
                <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="flex flex-1 items-center gap-3 border-l border-line/60 p-4 transition-colors hover:text-gold">
                  <MessageCircle className="size-[18px] text-muted" strokeWidth={1.75} /> WhatsApp
                </a>
              )}
            </div>
          )}
        </div>
      </Section>

      <TrialForm />

      <footer className="mx-auto mt-12 max-w-xl px-4 text-center text-xs text-muted">
        <Stars className="mb-4" />
        <div>OldSchool Gym · Pineto (TE)</div>
        <div className="mt-2 flex justify-center gap-4">
          <Link to="/privacy" className="hover:text-gold">
            Privacy
          </Link>
          <Link to="/cookie" className="hover:text-gold">
            Cookie
          </Link>
          <Link to="/regolamento" className="hover:text-gold">
            Regolamento
          </Link>
        </div>
      </footer>
    </div>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function TrialForm() {
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const c = contact.trim()
    const isEmail = c.includes('@')
    const digits = c.replace(/[^\d+]/g, '')
    if (isEmail ? !EMAIL_RE.test(c) : digits.replace(/\D/g, '').length < 8) return toast.error('Scrivi una email valida o un numero di telefono')
    if (!consent) return toast.error('Accetta la privacy per inviare la richiesta')
    setBusy(true)
    const { error } = await supabase.from('leads').insert({
      full_name: name.trim(),
      email: isEmail ? c.slice(0, 200) : null,
      phone: isEmail ? null : digits.slice(0, 20),
      source: 'Sito web',
      status: 'new',
    })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    setOk(true)
  }

  return (
    <Section id="prova" title="Prova gratis">
      <div className="rounded-xl bg-gold p-4 text-ink">
        {ok ? (
          <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }} className="py-4 text-center">
            <div className="font-varsity text-xl">Ricevuto</div>
            <p className="mt-1 text-sm text-ink/70">Ti contattiamo noi per fissare il primo allenamento</p>
          </m.div>
        ) : (
          <form onSubmit={submit} className="space-y-3 [&_.label]:!text-ink/70 [&_input]:border-ink/15 [&_input]:bg-white [&_input]:text-ink">
            <p className="text-sm text-ink/75">Lascia nome e un contatto, ti richiamiamo noi</p>
            <Field label="Nome">
              <Input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Telefono o email">
              <Input required maxLength={200} autoComplete="on" inputMode="email" value={contact} onChange={(e) => setContact(e.target.value)} />
            </Field>
            <label className="flex items-start gap-2 text-xs text-ink/80">
              <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
              <span>
                Acconsento al trattamento dei dati per essere ricontattato, come da{' '}
                <Link to="/privacy" className="underline">
                  informativa privacy
                </Link>
              </span>
            </label>
            <Button type="submit" variant="navy" block size="lg" loading={busy} className="!bg-ink !text-gold">
              Prenota la prova
            </Button>
          </form>
        )}
      </div>
    </Section>
  )
}
