import { motion } from 'framer-motion'
import { BarChart3, ChevronRight, ClipboardList, Download, History, Megaphone, MessageCircle, Package, Phone, Plus, ScanLine, Settings, ShoppingBag, Tag, Trash2, UserPlus, Users } from 'lucide-react'
import { lazy, Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge, Button, Card, Empty, Field, Input, Loading, PageHeader, SectionTitle, Segmented, Select, Sheet, Skeleton, Stat, Textarea, Toggle } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { downloadCsv, euro, fmtDate, fmtRelative, isoDate, methodLabel } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { errMsg, supabase } from '../../lib/supabase'
import type { Announcement, GymSettings, Lead, PaymentMethod, Plan, Product } from '../../lib/types'

const Charts = lazy(() => import('../../components/Charts'))

/* ================= MENU ALTRO ================= */
export function More() {
  const { isFront, isAdmin } = useAuth()
  const items = [
    { to: '/staff/checkin', icon: ScanLine, label: 'Check-in QR', show: true },
    { to: '/staff/schede', icon: ClipboardList, label: 'Schede ed esercizi', show: true },
    { to: '/staff/messaggi', icon: MessageCircle, label: 'Messaggi', show: true },
    { to: '/staff/comunicazioni', icon: Megaphone, label: 'Comunicazioni e news', show: isFront },
    { to: '/staff/lead', icon: UserPlus, label: 'Lead e prove gratuite', show: isFront },
    { to: '/staff/statistiche', icon: BarChart3, label: 'Statistiche', show: isFront },
    { to: '/staff/listino', icon: Tag, label: 'Listino e codici sconto', show: isAdmin },
    { to: '/staff/shop', icon: ShoppingBag, label: 'Prodotti e vendite', show: isFront },
    { to: '/staff/export', icon: Download, label: 'Export per il commercialista', show: isFront },
    { to: '/staff/impostazioni', icon: Settings, label: 'Impostazioni palestra', show: isAdmin },
    { to: '/staff/registro', icon: History, label: 'Registro attività', show: isAdmin },
    { to: '/app', icon: Users, label: 'Vista cliente (la mia app)', show: true },
  ].filter((i) => i.show)
  return (
    <div>
      <PageHeader title="Altro" kicker="Strumenti di gestione" />
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((it, i) => (
          <motion.div key={it.to} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.03 } }}>
            <Link to={it.to} className="card flex items-center gap-3 p-4 transition hover:border-gold/40">
              <span className="grid size-11 place-items-center rounded-xl bg-gold/15 text-gold">
                <it.icon className="size-5" />
              </span>
              <span className="flex-1 font-semibold">{it.label}</span>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ================= COMUNICAZIONI ================= */
export function Comms() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<'news' | 'push'>('news')
  const [edit, setEdit] = useState<Partial<Announcement> | null>(null)
  const [push, setPush] = useState({ title: '', body: '', target: 'all' })
  const [busy, setBusy] = useState(false)
  const { data, reload } = useAsync(async () => {
    const { data } = await supabase.from('announcements').select('*').order('published_at', { ascending: false }).limit(50)
    return (data as Announcement[]) ?? []
  })
  async function saveNews() {
    if (!edit?.title || !edit.body) return toast.error('Titolo e testo obbligatori')
    const row = { title: edit.title, body: edit.body, category: edit.category ?? 'News', is_pinned: !!edit.is_pinned, audience: edit.audience ?? 'all', created_by: profile!.id }
    const { error } = edit.id ? await supabase.from('announcements').update(row).eq('id', edit.id) : await supabase.from('announcements').insert(row)
    if (error) return toast.error(errMsg(error))
    toast.success(edit.id ? 'News aggiornata' : 'News pubblicata e notificata')
    setEdit(null)
    reload()
  }
  async function sendPush() {
    if (!push.title) return toast.error('Inserisci un titolo')
    setBusy(true)
    const { data, error } = await supabase.rpc('broadcast', { p_title: push.title, p_body: push.body, p_target: push.target })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success(`Notifica inviata a ${data} persone`)
    setPush({ title: '', body: '', target: 'all' })
  }
  return (
    <div>
      <PageHeader title="Comunicazioni" back="/staff/altro" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'news', label: 'Bacheca' },
          { value: 'push', label: 'Notifica a gruppi' },
        ]}
        className="mb-5"
      />
      {tab === 'news' ? (
        <>
          <Button block icon={<Plus className="size-4" />} onClick={() => setEdit({ category: 'News', audience: 'all' })}>
            Nuova news
          </Button>
          <div className="mt-4 space-y-2">
            {(data ?? []).map((n) => (
              <button key={n.id} onClick={() => setEdit(n)} className="card flex w-full items-center gap-3 p-4 text-left">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Badge tone="gold">{n.category}</Badge>
                    {n.is_pinned && <Badge tone="blue">In evidenza</Badge>}
                  </div>
                  <div className="mt-1 font-semibold">{n.title}</div>
                  <div className="text-xs text-muted">{fmtRelative(n.published_at)}</div>
                </div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <Card className="space-y-3">
          <Field label="A chi">
            <Select value={push.target} onChange={(e) => setPush({ ...push, target: e.target.value })}>
              <option value="all">Tutti</option>
              <option value="clients">Tutti i clienti</option>
              <option value="active">Clienti con abbonamento attivo</option>
              <option value="expired">Clienti scaduti (per farli tornare)</option>
              <option value="marketing">Solo chi ha accettato le promozioni</option>
              <option value="staff">Solo lo staff</option>
            </Select>
          </Field>
          <Field label="Titolo">
            <Input value={push.title} maxLength={140} onChange={(e) => setPush({ ...push, title: e.target.value })} />
          </Field>
          <Field label="Messaggio">
            <Textarea value={push.body} maxLength={2000} onChange={(e) => setPush({ ...push, body: e.target.value })} />
          </Field>
          <p className="text-xs text-muted">Per le promozioni usa il gruppo "Solo chi ha accettato le promozioni" per rispettare il GDPR.</p>
          <Button block size="lg" loading={busy} icon={<Megaphone className="size-4" />} onClick={sendPush}>
            Invia notifica
          </Button>
        </Card>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Modifica news' : 'Nuova news'} footer={
        <div className="flex gap-2">
          {edit?.id && (
            <Button variant="danger" aria-label="Elimina" onClick={async () => { await supabase.from('announcements').delete().eq('id', edit.id!); setEdit(null); reload() }}>
              <Trash2 className="size-4" />
            </Button>
          )}
          <Button block size="lg" onClick={saveNews}>Pubblica</Button>
        </div>
      }>
        {edit && (
          <div className="space-y-3">
            <Field label="Titolo">
              <Input value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Categoria">
                <Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                  {['News', 'Evento', 'Chiusura', 'Promo', 'Corsi'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Visibile a">
                <Select value={edit.audience} onChange={(e) => setEdit({ ...edit, audience: e.target.value as Announcement['audience'] })}>
                  <option value="all">Tutti (anche sito)</option>
                  <option value="clients">Solo iscritti</option>
                  <option value="staff">Solo staff</option>
                </Select>
              </Field>
            </div>
            <Field label="Testo">
              <Textarea className="min-h-40" value={edit.body ?? ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />
            </Field>
            <Toggle label="In evidenza" checked={!!edit.is_pinned} onChange={(v) => setEdit({ ...edit, is_pinned: v })} />
          </div>
        )}
      </Sheet>
    </div>
  )
}

/* ================= STATISTICHE ================= */
interface Stats {
  by_hour: { h: number; n: number }[]
  by_weekday: { d: number; n: number }[]
  top_courses: { title: string; n: number }[]
  revenue_months: { m: string; cents: number }[]
  renewal_rate: number | null
  no_show_rate: number | null
  at_risk_clients: { id: string; first_name: string; last_name: string; phone: string | null; last_checkin: string | null }[]
}
const WD = ['', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

export function StatsPage() {
  const { data: s, loading } = useAsync(async () => {
    const { data, error } = await supabase.rpc('admin_stats')
    if (error) throw error
    return data as Stats
  })
  if (loading || !s) return <Loading rows={5} />
  return (
    <div>
      <PageHeader title="Statistiche" back="/staff/altro" kicker="Ultimi 30-60 giorni" />
      <div className="grid grid-cols-2 gap-3">
        <Stat tone="gold" label="Tasso di rinnovo" value={s.renewal_rate != null ? `${s.renewal_rate}%` : '—'} sub="abbonamenti scaduti negli ultimi 90 gg" />
        <Stat label="No-show" value={s.no_show_rate != null ? `${s.no_show_rate}%` : '—'} sub="prenotati ma assenti" />
      </div>
      <Suspense fallback={<Skeleton className="mt-6 h-60" />}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <SectionTitle>Fasce orarie più piene</SectionTitle>
            <Card className="p-3">
              <Charts kind="bar" data={s.by_hour.map((x) => ({ x: `${x.h}`, y: x.n }))} />
            </Card>
          </div>
          <div>
            <SectionTitle>Giorni della settimana</SectionTitle>
            <Card className="p-3">
              <Charts kind="bar" color="#2B5BA8" data={s.by_weekday.map((x) => ({ x: WD[x.d], y: x.n }))} />
            </Card>
          </div>
          <div>
            <SectionTitle>Incassi ultimi 6 mesi</SectionTitle>
            <Card className="p-3">
              <Charts kind="area" unit="€" data={s.revenue_months.map((x) => ({ x: fmtDate(`${x.m}-01`, 'MMM'), y: Math.round(x.cents / 100) }))} />
            </Card>
          </div>
          <div>
            <SectionTitle>Corsi più seguiti</SectionTitle>
            <Card className="space-y-2">
              {s.top_courses.length === 0 && <p className="text-sm text-muted">Ancora nessun dato.</p>}
              {s.top_courses.map((c) => {
                const max = Math.max(...s.top_courses.map((x) => x.n))
                return (
                  <div key={c.title}>
                    <div className="flex justify-between text-sm">
                      <span>{c.title}</span>
                      <span className="text-muted">{c.n}</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                      <motion.div className="h-full rounded-full bg-gold" initial={{ width: 0 }} animate={{ width: `${(c.n / max) * 100}%` }} />
                    </div>
                  </div>
                )
              })}
            </Card>
          </div>
        </div>
      </Suspense>
      <SectionTitle>Clienti a rischio abbandono</SectionTitle>
      <p className="-mt-2 mb-3 text-xs text-muted">Abbonamento attivo ma nessun ingresso recente. Una telefonata può fare la differenza.</p>
      <div className="space-y-2">
        {s.at_risk_clients.length === 0 && <p className="card p-4 text-sm text-muted">Nessuno: ottimo lavoro! 💪</p>}
        {s.at_risk_clients.map((c) => (
          <div key={c.id} className="card flex items-center gap-3 p-3">
            <Link to={`/staff/clienti/${c.id}`} className="flex-1">
              <div className="font-semibold">
                {c.first_name} {c.last_name}
              </div>
              <div className="text-xs text-muted">{c.last_checkin ? `Ultimo ingresso ${fmtRelative(c.last_checkin)}` : 'Mai entrato'}</div>
            </Link>
            {c.phone && (
              <a href={`tel:${c.phone}`} className="grid size-10 place-items-center rounded-xl bg-gold text-ink" aria-label="Chiama">
                <Phone className="size-4" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ================= LEAD ================= */
const leadLabel: Record<Lead['status'], string> = { new: 'Nuovo', contacted: 'Contattato', trial: 'Prova fissata', converted: 'Iscritto', lost: 'Perso' }
export function LeadsPage() {
  const [edit, setEdit] = useState<Partial<Lead> | null>(null)
  const { data, loading, reload } = useAsync(async () => {
    const { data } = await supabase.from('leads').select('*').order('created_at', { ascending: false })
    return (data as Lead[]) ?? []
  })
  async function save() {
    if (!edit?.full_name) return toast.error('Nome obbligatorio')
    const row = { full_name: edit.full_name, phone: edit.phone || null, email: edit.email || null, source: edit.source || 'Reception', status: edit.status ?? 'new', trial_date: edit.trial_date || null, notes: edit.notes || null }
    const { error } = edit.id ? await supabase.from('leads').update(row).eq('id', edit.id) : await supabase.from('leads').insert({ ...row, status: 'new' })
    if (error) return toast.error(errMsg(error))
    setEdit(null)
    reload()
  }
  const tone = (s: Lead['status']) => (s === 'new' ? 'gold' : s === 'converted' ? 'green' : s === 'lost' ? 'red' : 'blue')
  return (
    <div>
      <PageHeader title="Lead" back="/staff/altro" kicker="Prove gratuite e richieste info" right={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEdit({ status: 'new' })}>Nuovo</Button>} />
      {loading ? (
        <Loading />
      ) : !data?.length ? (
        <Empty icon={<UserPlus className="size-7" />} title="Nessun lead" text="Le richieste di prova dal sito e i pass ospite arrivano qui." />
      ) : (
        <div className="space-y-2">
          {data.map((l) => (
            <button key={l.id} onClick={() => setEdit(l)} className="card flex w-full items-center gap-3 p-3 text-left">
              <div className="flex-1">
                <div className="font-semibold">{l.full_name}</div>
                <div className="text-xs text-muted">
                  {l.source} · {fmtRelative(l.created_at)} {l.trial_date && `· prova ${fmtDate(l.trial_date, 'd/M')}`}
                </div>
              </div>
              <Badge tone={tone(l.status)}>{leadLabel[l.status]}</Badge>
            </button>
          ))}
        </div>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Lead' : 'Nuovo lead'} footer={<Button block size="lg" onClick={save}>Salva</Button>}>
        {edit && (
          <div className="space-y-3">
            <Field label="Nome">
              <Input value={edit.full_name ?? ''} onChange={(e) => setEdit({ ...edit, full_name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefono">
                <Input value={edit.phone ?? ''} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
              </Field>
              <Field label="Email">
                <Input value={edit.email ?? ''} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
              </Field>
              <Field label="Stato">
                <Select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value as Lead['status'] })}>
                  {Object.entries(leadLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Data prova">
                <Input type="date" value={edit.trial_date ?? ''} onChange={(e) => setEdit({ ...edit, trial_date: e.target.value })} />
              </Field>
            </div>
            <Field label="Note">
              <Textarea value={edit.notes ?? ''} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} />
            </Field>
            {edit.phone && (
              <div className="flex gap-2">
                <a className="flex-1" href={`tel:${edit.phone}`}>
                  <Button block variant="ghost" icon={<Phone className="size-4" />}>Chiama</Button>
                </a>
                <a className="flex-1" href={`https://wa.me/${edit.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  <Button block variant="ghost" icon={<MessageCircle className="size-4" />}>WhatsApp</Button>
                </a>
              </div>
            )}
            {edit.id && (
              <Button variant="danger" block onClick={async () => { await supabase.from('leads').delete().eq('id', edit.id!); setEdit(null); reload() }}>
                Elimina lead
              </Button>
            )}
          </div>
        )}
      </Sheet>
    </div>
  )
}

/* ================= LISTINO ================= */
export function PricingPage() {
  const [tab, setTab] = useState<'piani' | 'codici'>('piani')
  const [edit, setEdit] = useState<Partial<Plan> & { featuresText?: string } | null>(null)
  const { data, reload } = useAsync(async () => {
    const { data } = await supabase.from('plans').select('*').order('sort')
    return (data as Plan[]) ?? []
  })
  const { data: codes, reload: reloadCodes } = useAsync(async () => {
    const { data } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false })
    return (data as { id: string; code: string; description: string | null; percent: number | null; amount_cents: number | null; valid_until: string | null; is_active: boolean }[]) ?? []
  })
  const [code, setCode] = useState({ code: '', percent: '10', valid_until: '', description: '' })

  async function save() {
    if (!edit?.name) return toast.error('Nome obbligatorio')
    const row = {
      name: edit.name,
      description: edit.description ?? null,
      kind: edit.kind ?? 'time',
      duration_days: edit.kind === 'entries' ? edit.duration_days ?? null : edit.duration_days ?? 30,
      entries: edit.kind === 'entries' ? edit.entries ?? 10 : null,
      price_cents: edit.price_cents ?? 0,
      highlight: !!edit.highlight,
      features: (edit.featuresText ?? edit.features?.join('\n') ?? '').split('\n').map((s) => s.trim()).filter(Boolean),
      is_active: edit.is_active ?? true,
      sort: edit.sort ?? (data?.length ?? 0),
    }
    const { error } = edit.id ? await supabase.from('plans').update(row).eq('id', edit.id) : await supabase.from('plans').insert(row)
    if (error) return toast.error(errMsg(error))
    toast.success('Listino aggiornato')
    setEdit(null)
    reload()
  }
  async function addCode() {
    if (!code.code) return
    const { error } = await supabase.from('discount_codes').insert({ code: code.code.toUpperCase(), percent: Number(code.percent), valid_until: code.valid_until || null, description: code.description || null })
    if (error) return toast.error(errMsg(error))
    setCode({ code: '', percent: '10', valid_until: '', description: '' })
    reloadCodes()
  }

  return (
    <div>
      <PageHeader title="Listino" back="/staff/altro" />
      <Segmented value={tab} onChange={setTab} options={[{ value: 'piani', label: 'Abbonamenti' }, { value: 'codici', label: 'Codici sconto' }]} className="mb-5" />
      {tab === 'piani' ? (
        <>
          <Button block icon={<Plus className="size-4" />} onClick={() => setEdit({ kind: 'time', duration_days: 30, is_active: true })}>
            Nuovo piano
          </Button>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {(data ?? []).map((p) => (
              <button key={p.id} onClick={() => setEdit(p)} className={`card p-4 text-left ${!p.is_active ? 'opacity-50' : ''} ${p.highlight ? 'border-gold/60' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.name}</div>
                  <div className="font-display text-2xl text-gold">{euro(p.price_cents)}</div>
                </div>
                <div className="text-xs text-muted">{p.kind === 'entries' ? `${p.entries} ingressi` : `${p.duration_days} giorni`}</div>
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Codice">
                <Input value={code.code} onChange={(e) => setCode({ ...code, code: e.target.value.toUpperCase() })} />
              </Field>
              <Field label="Sconto %">
                <Input inputMode="numeric" value={code.percent} onChange={(e) => setCode({ ...code, percent: e.target.value })} />
              </Field>
              <Field label="Valido fino al">
                <Input type="date" value={code.valid_until} onChange={(e) => setCode({ ...code, valid_until: e.target.value })} />
              </Field>
              <Field label="Descrizione">
                <Input value={code.description} onChange={(e) => setCode({ ...code, description: e.target.value })} />
              </Field>
            </div>
            <Button block onClick={addCode}>Crea codice</Button>
          </Card>
          <div className="mt-4 space-y-2">
            {(codes ?? []).map((c) => (
              <div key={c.id} className="card flex items-center gap-3 p-3">
                <span className="rounded-lg bg-gold px-2 py-1 font-varsity text-sm text-ink">{c.code}</span>
                <span className="flex-1 text-sm">
                  -{c.percent}% {c.valid_until && <span className="text-muted">· fino al {fmtDate(c.valid_until, 'd/M/yy')}</span>}
                </span>
                <Toggle label="" checked={c.is_active} onChange={async (v) => { await supabase.from('discount_codes').update({ is_active: v }).eq('id', c.id); reloadCodes() }} />
              </div>
            ))}
          </div>
        </>
      )}
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Modifica piano' : 'Nuovo piano'} footer={<Button block size="lg" onClick={save}>Salva</Button>}>
        {edit && (
          <div className="space-y-3">
            <Field label="Nome">
              <Input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Descrizione breve">
              <Input value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <Segmented value={edit.kind ?? 'time'} onChange={(v) => setEdit({ ...edit, kind: v })} options={[{ value: 'time', label: 'A tempo' }, { value: 'entries', label: 'Pacchetto ingressi' }]} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Prezzo €">
                <Input inputMode="decimal" value={edit.price_cents != null ? edit.price_cents / 100 : ''} onChange={(e) => setEdit({ ...edit, price_cents: Math.round(Number(e.target.value.replace(',', '.')) * 100) })} />
              </Field>
              {edit.kind === 'entries' ? (
                <Field label="Ingressi">
                  <Input inputMode="numeric" value={edit.entries ?? ''} onChange={(e) => setEdit({ ...edit, entries: Number(e.target.value) })} />
                </Field>
              ) : null}
              <Field label={edit.kind === 'entries' ? 'Validità giorni' : 'Durata giorni'}>
                <Input inputMode="numeric" value={edit.duration_days ?? ''} onChange={(e) => setEdit({ ...edit, duration_days: Number(e.target.value) || null })} />
              </Field>
            </div>
            <Field label="Vantaggi (uno per riga)">
              <Textarea value={edit.featuresText ?? edit.features?.join('\n') ?? ''} onChange={(e) => setEdit({ ...edit, featuresText: e.target.value })} />
            </Field>
            <Toggle label="In evidenza sul sito" checked={!!edit.highlight} onChange={(v) => setEdit({ ...edit, highlight: v })} />
            <Toggle label="Attivo" checked={edit.is_active ?? true} onChange={(v) => setEdit({ ...edit, is_active: v })} />
          </div>
        )}
      </Sheet>
    </div>
  )
}

/* ================= SHOP ================= */
export function ShopPage() {
  const { profile } = useAuth()
  const [edit, setEdit] = useState<Partial<Product> | null>(null)
  const [sell, setSell] = useState<Product | null>(null)
  const [qty, setQty] = useState(1)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const { data, reload } = useAsync(async () => {
    const { data } = await supabase.from('products').select('*').order('category').order('name')
    return (data as Product[]) ?? []
  })
  const { data: sales, reload: reloadSales } = useAsync(async () => {
    const { data } = await supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(20)
    return (data as { id: string; product_name: string; quantity: number; total_cents: number; created_at: string }[]) ?? []
  })
  async function save() {
    if (!edit?.name) return
    const row = { name: edit.name, category: edit.category ?? 'Integratori', price_cents: edit.price_cents ?? 0, stock: edit.stock ?? 0, is_active: edit.is_active ?? true }
    const { error } = edit.id ? await supabase.from('products').update(row).eq('id', edit.id) : await supabase.from('products').insert(row)
    if (error) return toast.error(errMsg(error))
    setEdit(null)
    reload()
  }
  async function doSell() {
    if (!sell) return
    const { error } = await supabase.from('sales').insert({ product_id: sell.id, product_name: sell.name, quantity: qty, total_cents: sell.price_cents * qty, method, created_by: profile!.id })
    if (error) return toast.error(errMsg(error))
    await supabase.from('products').update({ stock: Math.max(0, sell.stock - qty) }).eq('id', sell.id)
    toast.success(`Venduto: ${euro(sell.price_cents * qty)}`)
    setSell(null)
    setQty(1)
    reload()
    reloadSales()
  }
  return (
    <div>
      <PageHeader title="Shop" back="/staff/altro" kicker="Inventario e vendite al banco" right={<Button size="sm" icon={<Plus className="size-4" />} onClick={() => setEdit({ category: 'Integratori' })}>Prodotto</Button>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {(data ?? []).map((p) => (
          <div key={p.id} className="card p-3">
            <div className="flex items-start justify-between">
              <Package className="size-5 text-gold" />
              <Badge tone={p.stock <= 3 ? 'red' : 'gray'}>{p.stock} pz</Badge>
            </div>
            <button onClick={() => setEdit(p)} className="mt-2 block text-left">
              <div className="line-clamp-1 text-sm font-semibold">{p.name}</div>
              <div className="text-xs text-muted">{p.category}</div>
            </button>
            <div className="mt-2 flex items-center justify-between">
              <span className="font-display text-xl">{euro(p.price_cents)}</span>
              <Button size="sm" disabled={p.stock <= 0} onClick={() => setSell(p)}>
                Vendi
              </Button>
            </div>
          </div>
        ))}
      </div>
      <SectionTitle>Ultime vendite</SectionTitle>
      <div className="space-y-1.5">
        {(sales ?? []).map((s) => (
          <div key={s.id} className="flex justify-between rounded-xl bg-surface/50 px-3 py-2 text-sm">
            <span>
              {s.quantity}× {s.product_name}
            </span>
            <span className="text-muted">
              {euro(s.total_cents)} · {fmtRelative(s.created_at)}
            </span>
          </div>
        ))}
      </div>
      <Sheet open={!!sell} onClose={() => setSell(null)} title={`Vendi ${sell?.name ?? ''}`} footer={<Button block size="lg" onClick={doSell}>Incassa {euro((sell?.price_cents ?? 0) * qty)}</Button>}>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantità">
            <Input inputMode="numeric" value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
          </Field>
          <Field label="Metodo">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(methodLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Sheet>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Modifica prodotto' : 'Nuovo prodotto'} footer={<Button block size="lg" onClick={save}>Salva</Button>}>
        {edit && (
          <div className="space-y-3">
            <Field label="Nome">
              <Input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Categoria">
                <Select value={edit.category} onChange={(e) => setEdit({ ...edit, category: e.target.value })}>
                  {['Integratori', 'Bevande', 'Snack', 'Merchandising', 'Accessori'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Prezzo €">
                <Input inputMode="decimal" value={edit.price_cents != null ? edit.price_cents / 100 : ''} onChange={(e) => setEdit({ ...edit, price_cents: Math.round(Number(e.target.value.replace(',', '.')) * 100) })} />
              </Field>
              <Field label="Scorta">
                <Input inputMode="numeric" value={edit.stock ?? 0} onChange={(e) => setEdit({ ...edit, stock: Number(e.target.value) || 0 })} />
              </Field>
            </div>
            <Toggle label="In vendita" checked={edit.is_active ?? true} onChange={(v) => setEdit({ ...edit, is_active: v })} />
          </div>
        )}
      </Sheet>
    </div>
  )
}

/* ================= EXPORT ================= */
export function ExportPage() {
  const [from, setFrom] = useState(isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [to, setTo] = useState(isoDate())
  const [busy, setBusy] = useState('')
  async function payments() {
    setBusy('p')
    const { data } = await supabase.from('payments').select('*, profiles!payments_user_id_fkey(first_name, last_name, email)').eq('status', 'paid').gte('paid_at', from).lte('paid_at', `${to}T23:59:59`).order('paid_at')
    setBusy('')
    const rows = ((data as unknown as { receipt_number: number; paid_at: string; description: string; amount_cents: number; method: string; profiles: { first_name: string; last_name: string; email: string } }[]) ?? []).map((p) => ({
      Ricevuta: p.receipt_number,
      Data: p.paid_at.slice(0, 10),
      Cliente: `${p.profiles?.first_name} ${p.profiles?.last_name}`,
      Email: p.profiles?.email,
      Descrizione: p.description,
      Importo: (p.amount_cents / 100).toFixed(2).replace('.', ','),
      Metodo: methodLabel[p.method],
    }))
    if (!rows.length) return toast.info('Nessun pagamento nel periodo')
    downloadCsv(`incassi-${from}_${to}.csv`, rows)
  }
  async function sales() {
    setBusy('s')
    const { data } = await supabase.from('sales').select('*').gte('created_at', from).lte('created_at', `${to}T23:59:59`).order('created_at')
    setBusy('')
    const rows = ((data as { created_at: string; product_name: string; quantity: number; total_cents: number; method: string }[]) ?? []).map((s) => ({ Data: s.created_at.slice(0, 10), Prodotto: s.product_name, Quantità: s.quantity, Totale: (s.total_cents / 100).toFixed(2).replace('.', ','), Metodo: methodLabel[s.method] }))
    if (!rows.length) return toast.info('Nessuna vendita nel periodo')
    downloadCsv(`vendite-${from}_${to}.csv`, rows)
  }
  async function checkins() {
    setBusy('c')
    const { data } = await supabase.from('checkins').select('checked_at, allowed, reason, profiles!checkins_user_id_fkey(first_name, last_name)').gte('checked_at', from).lte('checked_at', `${to}T23:59:59`).order('checked_at')
    setBusy('')
    const rows = ((data as unknown as { checked_at: string; allowed: boolean; reason: string | null; profiles: { first_name: string; last_name: string } }[]) ?? []).map((c) => ({ Data: c.checked_at.replace('T', ' ').slice(0, 16), Cliente: `${c.profiles?.first_name} ${c.profiles?.last_name}`, Esito: c.allowed ? 'OK' : c.reason }))
    if (!rows.length) return toast.info('Nessun ingresso nel periodo')
    downloadCsv(`ingressi-${from}_${to}.csv`, rows)
  }
  return (
    <div>
      <PageHeader title="Export" back="/staff/altro" kicker="CSV apribili con Excel" />
      <Card className="grid grid-cols-2 gap-3">
        <Field label="Dal">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Al">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </Card>
      <div className="mt-4 grid gap-3">
        <Button size="lg" loading={busy === 'p'} icon={<Download className="size-5" />} onClick={payments}>
          Incassi abbonamenti
        </Button>
        <Button size="lg" variant="navy" loading={busy === 's'} icon={<Download className="size-5" />} onClick={sales}>
          Vendite prodotti
        </Button>
        <Button size="lg" variant="ghost" loading={busy === 'c'} icon={<Download className="size-5" />} onClick={checkins}>
          Registro ingressi
        </Button>
      </div>
      <p className="mt-4 text-xs text-muted">L'elenco clienti si esporta dalla pagina Clienti. Le ricevute dell'app non sono documenti fiscali.</p>
    </div>
  )
}

/* ================= IMPOSTAZIONI ================= */
export function SettingsPage() {
  const { settings, refreshSettings } = useAuth()
  const [f, setF] = useState<GymSettings | null>(settings)
  const [busy, setBusy] = useState(false)
  useEffect(() => setF(settings), [settings])
  if (!f) return <Loading />
  async function save() {
    setBusy(true)
    const { id: _id, ...rest } = f!
    const { error } = await supabase.from('gym_settings').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', 1)
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    await refreshSettings()
    toast.success('Impostazioni salvate')
  }
  const set = <K extends keyof GymSettings>(k: K, v: GymSettings[K]) => setF({ ...f, [k]: v })
  return (
    <div>
      <PageHeader title="Impostazioni" back="/staff/altro" />
      <Card className="space-y-3">
        <div className="label text-gold">Palestra</div>
        <Field label="Nome">
          <Input value={f.name} onChange={(e) => set('name', e.target.value)} />
        </Field>
        <Field label="Slogan">
          <Input value={f.tagline ?? ''} onChange={(e) => set('tagline', e.target.value)} />
        </Field>
        <Field label="Indirizzo">
          <Input value={f.address ?? ''} onChange={(e) => set('address', e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefono">
            <Input value={f.phone ?? ''} onChange={(e) => set('phone', e.target.value)} />
          </Field>
          <Field label="WhatsApp">
            <Input value={f.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} />
          </Field>
          <Field label="Email">
            <Input value={f.email ?? ''} onChange={(e) => set('email', e.target.value)} />
          </Field>
          <Field label="Instagram">
            <Input value={f.instagram ?? ''} onChange={(e) => set('instagram', e.target.value)} />
          </Field>
        </div>
      </Card>
      <Card className="mt-4 space-y-2">
        <div className="label text-gold">Orari di apertura</div>
        {f.opening_hours.map((h, i) => (
          <div key={h.day} className="grid grid-cols-[90px_1fr_1fr_auto] items-center gap-2">
            <span className="text-sm">{h.label}</span>
            <Input type="time" value={h.open ?? ''} onChange={(e) => set('opening_hours', f.opening_hours.map((x, j) => (j === i ? { ...x, open: e.target.value || null } : x)))} className="!py-2" />
            <Input type="time" value={h.close ?? ''} onChange={(e) => set('opening_hours', f.opening_hours.map((x, j) => (j === i ? { ...x, close: e.target.value || null } : x)))} className="!py-2" />
            <button className="text-xs text-muted" onClick={() => set('opening_hours', f.opening_hours.map((x, j) => (j === i ? { ...x, open: null, close: null } : x)))}>
              Chiuso
            </button>
          </div>
        ))}
      </Card>
      <Card className="mt-4 space-y-3">
        <div className="label text-gold">Regole</div>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Disdetta (ore)">
            <Input inputMode="numeric" value={f.cancel_hours} onChange={(e) => set('cancel_hours', Number(e.target.value) || 0)} />
          </Field>
          <Field label="Capienza sala">
            <Input inputMode="numeric" value={f.max_capacity} onChange={(e) => set('max_capacity', Number(e.target.value) || 1)} />
          </Field>
          <Field label="Inattivo dopo gg">
            <Input inputMode="numeric" value={f.inactivity_days} onChange={(e) => set('inactivity_days', Number(e.target.value) || 7)} />
          </Field>
        </div>
        <Toggle label="Blocca ingresso senza certificato valido" desc="Il check-in viene rifiutato se il certificato manca o è scaduto" checked={f.block_without_certificate} onChange={(v) => set('block_without_certificate', v)} />
      </Card>
      <Button block size="lg" className="mt-5" loading={busy} onClick={save}>
        Salva impostazioni
      </Button>
      <p className="mt-4 text-center text-xs text-muted">Per nominare trainer, reception o altri admin apri la scheda della persona in Clienti e cambia il ruolo.</p>
    </div>
  )
}

/* ================= REGISTRO ================= */
const actionLabel: Record<string, string> = { insert: 'ha creato', update: 'ha modificato', delete: 'ha eliminato' }
const tableLabel: Record<string, string> = { memberships: 'un abbonamento', payments: 'un pagamento', plans: 'un piano', medical_certificates: 'un certificato', sales: 'una vendita', gym_settings: 'le impostazioni', profiles: 'un profilo' }
export function AuditPage() {
  const { data, loading } = useAsync(async () => {
    const [a, s] = await Promise.all([supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(150), supabase.rpc('get_staff')])
    const names = new Map(((s.data as { id: string; first_name: string }[]) ?? []).map((x) => [x.id, x.first_name]))
    return ((a.data as { id: number; actor_id: string | null; action: string; table_name: string; created_at: string }[]) ?? []).map((x) => ({ ...x, who: x.actor_id ? names.get(x.actor_id) ?? 'Staff' : 'Sistema' }))
  })
  return (
    <div>
      <PageHeader title="Registro" back="/staff/altro" kicker="Chi ha modificato cosa" />
      {loading ? (
        <Loading />
      ) : (
        <div className="space-y-1.5">
          {(data ?? []).map((a) => (
            <div key={a.id} className="flex items-center gap-3 rounded-xl bg-surface/50 px-3 py-2.5 text-sm">
              <History className="size-4 shrink-0 text-muted" />
              <span className="flex-1">
                <b>{a.who}</b> {actionLabel[a.action] ?? a.action} {tableLabel[a.table_name] ?? a.table_name}
              </span>
              <span className="text-xs text-muted">{fmtRelative(a.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
