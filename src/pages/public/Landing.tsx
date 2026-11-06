import { motion, useScroll, useTransform } from 'framer-motion'
import { ArrowRight, CalendarCheck, Clock, Dumbbell, MapPin, MessageCircle, Phone, QrCode, ShieldCheck, Sparkles, Star, TrendingUp, AtSign } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge, Button, Field, Input, Logo, PhotoPlaceholder, Textarea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { euro } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { errMsg, supabase } from '../../lib/supabase'
import type { Course, Plan } from '../../lib/types'

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const } },
}

function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div variants={fadeUp} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-60px' }} transition={{ delay }} className={className}>
      {children}
    </motion.div>
  )
}

export default function Landing() {
  const { session, settings, isStaff } = useAuth()
  const heroRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const logoY = useTransform(scrollYProgress, [0, 1], [0, 120])
  const logoScale = useTransform(scrollYProgress, [0, 1], [1, 0.8])

  const { data: plans } = useAsync(async () => {
    const { data } = await supabase.from('plans').select('*').eq('is_active', true).order('sort')
    return (data as Plan[]) ?? []
  })
  const { data: courses } = useAsync(async () => {
    const { data } = await supabase.from('courses').select('*').eq('is_active', true).order('name')
    return (data as Course[]) ?? []
  })

  const appHref = session ? (isStaff ? '/staff' : '/app') : '/registrati'

  return (
    <div className="relative overflow-x-hidden">
      {/* NAV */}
      <header className="safe-top fixed inset-x-0 top-0 z-40 bg-ink/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo size={40} />
            <span className="font-varsity text-base leading-none">
              OldSchool<span className="block text-[10px] tracking-[0.3em] text-gold">GYM · PINETO</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            {!session && (
              <Link to="/accedi" className="px-3 text-sm font-semibold text-cream/80 hover:text-gold">
                Accedi
              </Link>
            )}
            <Link to={appHref}>
              <Button size="sm">{session ? 'Apri app' : 'Iscriviti'}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section ref={heroRef} className="grain relative flex min-h-[100dvh] items-center overflow-hidden pt-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(43,91,168,0.45),transparent_55%),radial-gradient(ellipse_at_bottom_left,rgba(245,197,24,0.18),transparent_50%)]" />
        <div className="stripes absolute -right-20 top-24 h-64 w-64 rotate-12 rounded-3xl opacity-60" />
        <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 md:grid-cols-2">
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Badge tone="gold" className="mb-5">
                <Star className="size-3 fill-current" /> Pineto · Abruzzo · dal cuore old school
              </Badge>
            </motion.div>
            <h1 className="font-display text-[56px] uppercase leading-[0.92] tracking-tight sm:text-7xl md:text-8xl">
              {['Allenati', 'come una', 'volta.'].map((w, i) => (
                <motion.span key={w} className="block" initial={{ opacity: 0, y: 40, rotateX: -40 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ delay: 0.15 + i * 0.12, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
                  {w}
                </motion.span>
              ))}
              <motion.span className="text-shine block" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.7 }}>
                Con la tech di oggi.
              </motion.span>
            </h1>
            <motion.p className="mt-6 max-w-md text-lg text-cream/75" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
              Ferro, sudore e leggende degli anni '80 e '90. Prenoti le lezioni, segui la tua scheda e vedi i progressi, tutto dal telefono.
            </motion.p>
            <motion.div className="mt-8 flex flex-wrap gap-3" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.95 }}>
              <Link to={appHref}>
                <Button size="lg" icon={<ArrowRight className="size-5" />}>
                  {session ? "Entra nell'app" : 'Inizia ora'}
                </Button>
              </Link>
              <a href="#prova">
                <Button size="lg" variant="outline">
                  Prova gratuita
                </Button>
              </a>
            </motion.div>
          </div>
          <motion.div style={{ y: logoY, scale: logoScale }} className="relative mx-auto">
            <motion.div initial={{ opacity: 0, scale: 0.6, rotate: -12 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: 0.3, type: 'spring', stiffness: 120, damping: 14 }} className="animate-float">
              <div className="absolute inset-6 rounded-full bg-gold/30 blur-3xl" />
              <Logo size={340} className="relative max-w-[78vw]" />
            </motion.div>
          </motion.div>
        </div>
        <motion.div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-xs uppercase tracking-[0.3em] text-muted" animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
          Scorri
        </motion.div>
      </section>

      {/* MARQUEE */}
      <div className="overflow-hidden border-y border-gold/30 bg-gold py-3 text-ink">
        <motion.div className="flex w-max gap-10 whitespace-nowrap font-varsity text-lg uppercase" animate={{ x: ['0%', '-50%'] }} transition={{ repeat: Infinity, duration: 28, ease: 'linear' }}>
          {Array.from({ length: 2 }).flatMap((_, k) =>
            ['No pain no gain', '★', 'Boxe', '★', 'Bodybuilding', '★', 'Functional', '★', 'Old school spirit', '★', 'Personal training', '★'].map((t, i) => <span key={`${k}-${i}`}>{t}</span>),
          )}
        </motion.div>
      </div>

      {/* FEATURES APP */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <div className="label text-gold">L'app della palestra</div>
          <h2 className="mt-2 font-display text-5xl uppercase leading-none">Tutto in tasca</h2>
        </Reveal>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { i: CalendarCheck, t: 'Prenota in 2 tap', d: "Corsi ed eventi con posti in tempo reale e lista d'attesa automatica." },
            { i: QrCode, t: 'Entra con il QR', d: 'Il tuo pass personale: mostri il telefono in reception e sei dentro.' },
            { i: Dumbbell, t: 'Scheda sempre con te', d: 'Esercizi, serie e carichi dal tuo trainer. Segni i pesi mentre ti alleni.' },
            { i: TrendingUp, t: 'Progressi reali', d: 'Peso, misure e grafici per vedere quanto sei migliorato.' },
            { i: Sparkles, t: 'Notifiche utili', d: 'Promemoria lezioni, scadenze e news della palestra, mai spam.' },
            { i: ShieldCheck, t: 'Dati al sicuro', d: 'Privacy GDPR: esporti o cancelli i tuoi dati quando vuoi.' },
          ].map((f, i) => (
            <Reveal key={f.t} delay={i * 0.06}>
              <div className="card group h-full p-6 transition hover:-translate-y-1 hover:border-gold/50">
                <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-gold text-ink transition group-hover:rotate-6">
                  <f.i className="size-6" />
                </div>
                <h3 className="font-display text-2xl uppercase">{f.t}</h3>
                <p className="mt-2 text-sm text-muted">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* HALL OF FAME */}
      <section className="relative bg-cream py-20 text-ink">
        <div className="mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="label !text-navy">La nostra anima</div>
            <h2 className="mt-2 font-display text-5xl uppercase leading-none text-navy">Hall of Fame</h2>
            <p className="mt-3 max-w-lg text-ink/70">Le pareti della OldSchool raccontano i campioni del ring e le icone degli anni '80 e '90. Qui si respira la loro fame.</p>
          </Reveal>
          <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
            {['Il ring', 'La sala pesi', 'Le leggende', 'Il team', 'Anni 80', 'Anni 90', 'I guantoni', 'La community'].map((l, i) => (
              <Reveal key={l} delay={i * 0.05} className={i % 3 === 0 ? 'row-span-2' : ''}>
                <div className="overflow-hidden rounded-2xl" style={{ filter: 'grayscale(1) contrast(1.1)' }}>
                  <PhotoPlaceholder label={l} className={i % 3 === 0 ? 'aspect-[3/5]' : 'aspect-square'} tone={i % 2 ? 'navy' : 'dark'} />
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CORSI */}
      <section className="mx-auto max-w-6xl px-5 py-20">
        <Reveal>
          <div className="label text-gold">Corsi</div>
          <h2 className="mt-2 font-display text-5xl uppercase leading-none">Scegli il tuo round</h2>
        </Reveal>
        <div className="no-scrollbar -mx-5 mt-8 flex snap-x gap-4 overflow-x-auto px-5 pb-4">
          {(courses ?? []).map((c, i) => (
            <Reveal key={c.id} delay={i * 0.05} className="w-64 shrink-0 snap-start">
              <div className="card overflow-hidden p-0">
                <div className="relative">
                  <PhotoPlaceholder label={c.name} className="aspect-[4/3]" />
                  <span className="absolute left-3 top-3 h-1.5 w-10 rounded-full" style={{ background: c.color }} />
                </div>
                <div className="p-4">
                  <h3 className="font-display text-2xl uppercase">{c.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{c.description}</p>
                  <div className="mt-3 flex gap-2">
                    <Badge tone="gold">{c.duration_min} min</Badge>
                    <Badge>{c.level}</Badge>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* LISTINO */}
      <section className="relative overflow-hidden bg-navy py-20">
        <div className="stripes absolute inset-0 opacity-30" />
        <div className="relative mx-auto max-w-6xl px-5">
          <Reveal>
            <div className="label text-gold">Listino</div>
            <h2 className="mt-2 font-display text-5xl uppercase leading-none">Abbonamenti</h2>
          </Reveal>
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {(plans ?? []).map((p, i) => (
              <Reveal key={p.id} delay={i * 0.06}>
                <div className={`relative h-full rounded-3xl p-6 ${p.highlight ? 'bg-gold text-ink shadow-[0_20px_60px_-20px_rgba(245,197,24,0.8)]' : 'card'}`}>
                  {p.highlight && <span className="absolute -top-3 right-5 rounded-full bg-ink px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-gold">Più scelto</span>}
                  <div className="font-varsity text-lg uppercase">{p.name}</div>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="font-display text-6xl leading-none">{euro(p.price_cents)}</span>
                  </div>
                  <p className={`mt-2 text-sm ${p.highlight ? 'text-ink/70' : 'text-muted'}`}>{p.description}</p>
                  <ul className="mt-5 space-y-2 text-sm">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Star className="mt-0.5 size-3.5 shrink-0 fill-current" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-center text-xs text-cream/60">Prezzi indicativi. Iscrizione e pagamenti presso la reception.</p>
        </div>
      </section>

      {/* ORARI + CONTATTI */}
      <section className="mx-auto grid max-w-6xl gap-6 px-5 py-20 md:grid-cols-2">
        <Reveal>
          <div className="card h-full p-6">
            <div className="flex items-center gap-2 text-gold">
              <Clock className="size-5" />
              <span className="label !text-gold">Orari</span>
            </div>
            <ul className="mt-4 divide-y divide-line/50">
              {(settings?.opening_hours ?? []).map((h) => (
                <li key={h.day} className="flex justify-between py-2.5 text-sm">
                  <span className="font-medium">{h.label}</span>
                  <span className={h.open ? 'text-cream' : 'text-danger'}>{h.open ? `${h.open} – ${h.close}` : 'Chiuso'}</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="card h-full p-6">
            <div className="label text-gold">Dove siamo</div>
            <div className="mt-4 space-y-3 text-sm">
              <a className="flex items-center gap-3 hover:text-gold" href={`https://maps.google.com/?q=${encodeURIComponent(settings?.address ?? 'Pineto TE')}`} target="_blank" rel="noreferrer">
                <MapPin className="size-5 text-gold" /> {settings?.address}
              </a>
              <a className="flex items-center gap-3 hover:text-gold" href={`tel:${settings?.phone}`}>
                <Phone className="size-5 text-gold" /> {settings?.phone}
              </a>
              <a className="flex items-center gap-3 hover:text-gold" href={`https://wa.me/${(settings?.whatsapp ?? '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                <MessageCircle className="size-5 text-gold" /> WhatsApp
              </a>
              <a className="flex items-center gap-3 hover:text-gold" href={`https://instagram.com/${settings?.instagram}`} target="_blank" rel="noreferrer">
                <AtSign className="size-5 text-gold" /> @{settings?.instagram}
              </a>
            </div>
            <PhotoPlaceholder label="Mappa / foto ingresso" className="mt-5 aspect-video rounded-2xl" />
          </div>
        </Reveal>
      </section>

      <TrialForm />

      <footer className="border-t border-line/50 px-5 py-10 text-center text-xs text-muted">
        <Logo size={64} className="mx-auto mb-4 opacity-90" />
        <div>© {new Date().getFullYear()} OldSchool Gym · Pineto (TE)</div>
        <div className="mt-2 flex justify-center gap-4">
          <Link to="/privacy" className="hover:text-gold">
            Privacy
          </Link>
          <Link to="/cookie" className="hover:text-gold">
            Cookie
          </Link>
        </div>
      </footer>
    </div>
  )
}

function TrialForm() {
  const [f, setF] = useState({ full_name: '', phone: '', email: '', notes: '' })
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!consent) return toast.error('Accetta la privacy per inviare la richiesta')
    setBusy(true)
    const { error } = await supabase.from('leads').insert({ ...f, source: 'Sito web', status: 'new' })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    setOk(true)
  }
  return (
    <section id="prova" className="mx-auto max-w-xl px-5 pb-20">
      <Reveal>
        <div className="grain relative overflow-hidden rounded-3xl bg-gold p-6 text-ink sm:p-8">
          <h2 className="font-display text-5xl uppercase leading-none">Prova gratis</h2>
          <p className="mt-2 text-ink/70">Lasciaci i tuoi dati: ti richiamiamo per fissare il primo allenamento.</p>
          {ok ? (
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="mt-6 rounded-2xl bg-ink p-5 text-center text-cream">
              <div className="font-display text-3xl uppercase text-gold">Ricevuto! 🥊</div>
              <p className="mt-1 text-sm text-cream/70">Ti contatteremo a breve.</p>
            </motion.div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-3 [&_input]:bg-white/90 [&_input]:text-ink [&_textarea]:bg-white/90 [&_textarea]:text-ink [&_.label]:!text-ink/70">
              <Field label="Nome e cognome">
                <Input required minLength={2} maxLength={120} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telefono">
                  <Input type="tel" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
                </Field>
              </div>
              <Field label="Cosa ti interessa?">
                <Textarea maxLength={1000} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Es. sala pesi, boxe, dimagrimento…" />
              </Field>
              <label className="flex items-start gap-2 text-xs text-ink/80">
                <input type="checkbox" className="mt-0.5 size-4 accent-ink" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>
                  Acconsento al trattamento dei dati per essere ricontattato, come da{' '}
                  <Link to="/privacy" className="underline">
                    informativa privacy
                  </Link>
                  .
                </span>
              </label>
              <Button type="submit" variant="navy" block size="lg" loading={busy} className="!bg-ink !text-gold">
                Prenota la prova
              </Button>
            </form>
          )}
        </div>
      </Reveal>
    </section>
  )
}
