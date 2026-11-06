import { motion } from 'framer-motion'
import { CalendarCheck, CheckCircle2, ClipboardList, FileHeart, PauseCircle, Plus, Receipt, StickyNote } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, Badge, Button, Card, Empty, Field, Input, Loading, PageHeader, SectionTitle, Segmented, Select, Sheet, Toggle } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { bookingLabel, euro, fmtDate, fmtRelative, fullName, isoDate, methodLabel, roleLabel } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { errMsg, signedUrl, supabase } from '../../lib/supabase'
import type { Certificate, Membership, Payment, PaymentMethod, Plan, Profile, StaffMember, WorkoutPlan } from '../../lib/types'
import { MeasureSheet, ProgressTab } from '../client/Training'
import { statusBadge } from '../client/Membership'
import { ContactButtons } from './Clients'
import { PlanEditor } from './Workouts'

type Tab = 'info' | 'abbonamento' | 'schede' | 'progressi' | 'presenze'

export default function ClientDetail() {
  const { id } = useParams()
  const { isFront, isAdmin } = useAuth()
  const [tab, setTab] = useState<Tab>('info')
  const { data: c, loading, reload } = useAsync(async () => {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', id!).single()
    if (error) throw error
    return data as Profile
  }, [id])

  if (loading) return <Loading rows={4} />
  if (!c) return <Empty title="Cliente non trovato" />

  const tabs: { value: Tab; label: string }[] = [
    { value: 'info', label: 'Scheda' },
    ...(isFront ? [{ value: 'abbonamento' as Tab, label: 'Abbonamento' }] : []),
    { value: 'schede', label: 'Allenamento' },
    { value: 'progressi', label: 'Misure' },
    { value: 'presenze', label: 'Presenze' },
  ]

  return (
    <div>
      <PageHeader title="" back="/staff/clienti" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="-mt-14 mb-5 flex flex-col items-center text-center">
        <Avatar p={c} size={92} ring />
        <h1 className="mt-3 font-display text-3xl uppercase leading-none">{fullName(c)}</h1>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted">
          <Badge tone={c.role === 'client' ? 'gray' : 'gold'}>{roleLabel[c.role]}</Badge>
          {!c.is_active && <Badge tone="red">Disattivato</Badge>}
          <span>Iscritto {fmtRelative(c.created_at)}</span>
        </div>
        <div className="mt-3">
          <ContactButtons c={c} />
        </div>
      </motion.div>
      <Segmented<Tab> value={tab} onChange={setTab} options={tabs} className="mb-5" />
      {tab === 'info' && <InfoTab c={c} onChanged={reload} isAdmin={isAdmin} isFront={isFront} />}
      {tab === 'abbonamento' && <MembershipTab c={c} />}
      {tab === 'schede' && <PlansTab c={c} />}
      {tab === 'progressi' && <MeasuresTab c={c} />}
      {tab === 'presenze' && <AttendanceTab c={c} />}
    </div>
  )
}

/* ---------- INFO ---------- */
function InfoTab({ c, onChanged, isAdmin, isFront }: { c: Profile; onChanged: () => void; isAdmin: boolean; isFront: boolean }) {
  const { profile } = useAuth()
  const nav = useNavigate()
  const [f, setF] = useState({ first_name: c.first_name, last_name: c.last_name, phone: c.phone ?? '', birth_date: c.birth_date ?? '', trainer_id: c.trainer_id ?? '', role: c.role, is_active: c.is_active })
  const [busy, setBusy] = useState(false)
  const { data: trainers } = useAsync(async () => {
    const { data } = await supabase.rpc('get_staff')
    return ((data as StaffMember[]) ?? []).filter((s) => s.role === 'trainer' || s.role === 'admin')
  })
  const { data: notes, reload: reloadNotes } = useAsync(async () => {
    const { data } = await supabase.from('client_notes').select('*, author:profiles!client_notes_author_id_fkey(first_name)').eq('client_id', c.id).order('created_at', { ascending: false })
    return (data as { id: string; body: string; created_at: string; author_id: string; author: { first_name: string } | null }[]) ?? []
  }, [c.id])
  const [note, setNote] = useState('')

  async function save() {
    setBusy(true)
    const patch: Record<string, unknown> = { first_name: f.first_name, last_name: f.last_name, phone: f.phone || null, birth_date: f.birth_date || null }
    if (isFront) patch.trainer_id = f.trainer_id || null
    if (isAdmin) {
      patch.role = f.role
      patch.is_active = f.is_active
    }
    const { error } = await supabase.from('profiles').update(patch).eq('id', c.id)
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Salvato')
    onChanged()
  }
  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    const { error } = await supabase.from('client_notes').insert({ client_id: c.id, author_id: profile!.id, body: note.trim() })
    if (error) return toast.error(errMsg(error))
    setNote('')
    reloadNotes()
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome">
            <Input value={f.first_name} disabled={!isFront} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
          </Field>
          <Field label="Cognome">
            <Input value={f.last_name} disabled={!isFront} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
          </Field>
          <Field label="Telefono">
            <Input value={f.phone} disabled={!isFront} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          </Field>
          <Field label="Nascita">
            <Input type="date" value={f.birth_date} disabled={!isFront} onChange={(e) => setF({ ...f, birth_date: e.target.value })} />
          </Field>
        </div>
        <Field label="Email">
          <Input value={c.email ?? ''} disabled />
        </Field>
        {c.role === 'client' && (
          <Field label="Personal trainer assegnato">
            <Select value={f.trainer_id} disabled={!isFront} onChange={(e) => setF({ ...f, trainer_id: e.target.value })}>
              <option value="">Nessuno</option>
              {(trainers ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {fullName(t)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {isAdmin && (
          <>
            <Field label="Ruolo">
              <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Profile['role'] })}>
                <option value="client">Cliente</option>
                <option value="trainer">Personal trainer</option>
                <option value="reception">Reception</option>
                <option value="admin">Amministratore</option>
              </Select>
            </Field>
            <Toggle label="Account attivo" desc="Se disattivato non può entrare né usare l'app" checked={f.is_active} onChange={(v) => setF({ ...f, is_active: v })} />
          </>
        )}
        {isFront && (
          <Button block loading={busy} onClick={save}>
            Salva modifiche
          </Button>
        )}
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge tone={c.consent_privacy ? 'green' : 'red'}>Privacy {c.consent_privacy ? '✓' : '✗'}</Badge>
        <Badge tone={c.consent_marketing ? 'green' : 'gray'}>Marketing {c.consent_marketing ? '✓' : '✗'}</Badge>
        <Badge tone={c.consent_photos ? 'green' : 'gray'}>Foto {c.consent_photos ? '✓' : '✗'}</Badge>
        {c.referral_code && <Badge>Codice amico {c.referral_code}</Badge>}
      </div>

      {isFront && c.role === 'client' && <CertificatesBlock c={c} />}

      <SectionTitle>
        <span className="flex items-center gap-2">
          <StickyNote className="size-5 text-gold" /> Note interne
        </span>
      </SectionTitle>
      <form onSubmit={addNote} className="flex gap-2">
        <Input placeholder="Es. infortunio spalla destra, evitare military press" value={note} onChange={(e) => setNote(e.target.value)} />
        <Button type="submit" aria-label="Aggiungi nota" className="shrink-0">
          <Plus className="size-5" />
        </Button>
      </form>
      <div className="space-y-2">
        {(notes ?? []).map((n) => (
          <div key={n.id} className="rounded-2xl bg-surface/60 p-3 text-sm">
            <div className="whitespace-pre-wrap">{n.body}</div>
            <div className="mt-1 flex justify-between text-[11px] text-muted">
              <span>
                {n.author?.first_name ?? 'Staff'} · {fmtRelative(n.created_at)}
              </span>
              {(n.author_id === profile?.id || isAdmin) && (
                <button
                  onClick={async () => {
                    await supabase.from('client_notes').delete().eq('id', n.id)
                    reloadNotes()
                  }}
                  className="hover:text-danger"
                >
                  Elimina
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="pt-4 text-center text-xs text-muted">
        <button onClick={() => nav(`/staff/messaggi?con=${c.id}`)} className="text-gold">
          Apri chat con {c.first_name}
        </button>
      </p>
    </div>
  )
}

function CertificatesBlock({ c }: { c: Profile }) {
  const [exp, setExp] = useState('')
  const { data: certs, reload } = useAsync(async () => {
    const { data } = await supabase.from('medical_certificates').select('*').eq('user_id', c.id).order('expires_on', { ascending: false })
    return (data as Certificate[]) ?? []
  }, [c.id])
  async function addManual() {
    if (!exp) return toast.error('Inserisci la scadenza')
    const { error } = await supabase.from('medical_certificates').insert({ user_id: c.id, expires_on: exp, verified: true })
    if (error) return toast.error(errMsg(error))
    setExp('')
    toast.success('Certificato registrato')
    reload()
  }
  return (
    <>
      <SectionTitle>
        <span className="flex items-center gap-2">
          <FileHeart className="size-5 text-gold" /> Certificato medico
        </span>
      </SectionTitle>
      <div className="space-y-2">
        {(certs ?? []).map((ct) => {
          const expired = ct.expires_on < isoDate()
          return (
            <div key={ct.id} className="card flex items-center gap-3 p-3">
              <div className="flex-1">
                <div className="text-sm font-semibold">Scadenza {fmtDate(ct.expires_on)}</div>
                <div className="text-xs text-muted">{ct.kind}</div>
              </div>
              {expired ? <Badge tone="red">Scaduto</Badge> : ct.verified ? <Badge tone="green">Verificato</Badge> : <Badge tone="gold">Da verificare</Badge>}
              {ct.file_path && (
                <Button size="sm" variant="ghost" onClick={async () => { const u = await signedUrl('certificates', ct.file_path, 120); if (u) window.open(u, '_blank', 'noopener') }}>
                  Apri
                </Button>
              )}
              {!ct.verified && (
                <Button size="sm" variant="ghost" aria-label="Verifica" onClick={async () => { await supabase.from('medical_certificates').update({ verified: true }).eq('id', ct.id); reload() }}>
                  <CheckCircle2 className="size-4 text-success" />
                </Button>
              )}
            </div>
          )
        })}
        <div className="flex gap-2">
          <Input type="date" value={exp} onChange={(e) => setExp(e.target.value)} aria-label="Scadenza certificato cartaceo" />
          <Button variant="outline" className="shrink-0" onClick={addManual}>
            Registra cartaceo
          </Button>
        </div>
      </div>
    </>
  )
}

/* ---------- ABBONAMENTO & PAGAMENTI ---------- */
function MembershipTab({ c }: { c: Profile }) {
  const [addM, setAddM] = useState(false)
  const [addP, setAddP] = useState<Membership | null | 'free'>(null)
  const [suspend, setSuspend] = useState<Membership | null>(null)
  const { data, loading, reload } = useAsync(async () => {
    const [m, p] = await Promise.all([
      supabase.from('memberships').select('*').eq('user_id', c.id).order('start_date', { ascending: false }),
      supabase.from('payments').select('*').eq('user_id', c.id).order('created_at', { ascending: false }),
    ])
    return { ms: (m.data as Membership[]) ?? [], ps: (p.data as Payment[]) ?? [] }
  }, [c.id])
  if (loading || !data) return <Loading />
  return (
    <div>
      <div className="flex gap-2">
        <Button block icon={<Plus className="size-4" />} onClick={() => setAddM(true)}>
          Nuovo abbonamento
        </Button>
        <Button variant="outline" icon={<Receipt className="size-4" />} onClick={() => setAddP('free')}>
          Incasso
        </Button>
      </div>
      <SectionTitle>Abbonamenti</SectionTitle>
      {data.ms.length === 0 && <p className="text-sm text-muted">Nessun abbonamento.</p>}
      <div className="space-y-2">
        {data.ms.map((m) => (
          <div key={m.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-semibold">{m.plan_name}</div>
                <div className="text-xs text-muted">
                  {fmtDate(m.start_date)} → {m.end_date ? fmtDate(m.end_date) : 'senza scadenza'}
                  {m.entries_left != null && ` · ${m.entries_left} ingressi`}
                </div>
                <div className="mt-1 text-xs text-muted">{euro(m.price_cents)} {m.discount_code && `· codice ${m.discount_code}`}</div>
              </div>
              {statusBadge(m)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" icon={<Receipt className="size-3.5" />} onClick={() => setAddP(m)}>
                Registra pagamento
              </Button>
              {m.status === 'active' && (
                <Button size="sm" variant="ghost" icon={<PauseCircle className="size-3.5" />} onClick={() => setSuspend(m)}>
                  Sospendi
                </Button>
              )}
              {m.status === 'suspended' && (
                <Button size="sm" variant="ghost" onClick={async () => { await supabase.from('memberships').update({ status: 'active' }).eq('id', m.id); reload() }}>
                  Riattiva
                </Button>
              )}
              {m.status !== 'cancelled' && (
                <Button size="sm" variant="danger" onClick={async () => { if (confirm('Annullare questo abbonamento?')) { await supabase.from('memberships').update({ status: 'cancelled' }).eq('id', m.id); reload() } }}>
                  Annulla
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <SectionTitle>Pagamenti</SectionTitle>
      <div className="space-y-2">
        {data.ps.length === 0 && <p className="text-sm text-muted">Nessun pagamento.</p>}
        {data.ps.map((p) => (
          <div key={p.id} className="card flex items-center gap-3 p-3">
            <div className="flex-1">
              <div className="text-sm font-semibold">{p.description}</div>
              <div className="text-xs text-muted">
                {p.status === 'paid' ? `${fmtDate(p.paid_at)} · ${methodLabel[p.method]} · n. ${p.receipt_number}` : `Da pagare${p.due_date ? ` entro ${fmtDate(p.due_date)}` : ''}`}
              </div>
            </div>
            <div className="font-display text-xl">{euro(p.amount_cents)}</div>
            {p.status === 'pending' ? (
              <Button size="sm" onClick={async () => { await supabase.from('payments').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', p.id); toast.success('Segnato come pagato'); reload() }}>
                Incassa
              </Button>
            ) : (
              <Badge tone="green">Pagato</Badge>
            )}
          </div>
        ))}
      </div>
      <NewMembershipSheet open={addM} onClose={() => setAddM(false)} c={c} onSaved={reload} />
      <PaymentSheet target={addP} onClose={() => setAddP(null)} c={c} onSaved={reload} />
      <SuspendSheet m={suspend} onClose={() => setSuspend(null)} onSaved={reload} />
    </div>
  )
}

function NewMembershipSheet({ open, onClose, c, onSaved }: { open: boolean; onClose: () => void; c: Profile; onSaved: () => void }) {
  const { data: plans } = useAsync(async () => {
    const { data } = await supabase.from('plans').select('*').eq('is_active', true).order('sort')
    return (data as Plan[]) ?? []
  })
  const [planId, setPlanId] = useState('')
  const [start, setStart] = useState(isoDate())
  const [code, setCode] = useState('')
  const [price, setPrice] = useState('')
  const [paid, setPaid] = useState(true)
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [busy, setBusy] = useState(false)
  const plan = plans?.find((p) => p.id === planId)

  async function applyCode() {
    if (!code || !plan) return
    const { data } = await supabase.from('discount_codes').select('*').eq('code', code.trim().toUpperCase()).eq('is_active', true).maybeSingle()
    if (!data || (data.valid_until && data.valid_until < isoDate())) return toast.error('Codice non valido o scaduto')
    const base = plan.price_cents
    const final = data.percent ? Math.round(base * (1 - data.percent / 100)) : Math.max(0, base - (data.amount_cents ?? 0))
    setPrice((final / 100).toFixed(2))
    toast.success(`Sconto applicato: ${data.percent ? `${data.percent}%` : euro(data.amount_cents)}`)
  }

  async function save() {
    if (!plan) return toast.error('Scegli un piano')
    setBusy(true)
    const cents = Math.round(Number((price || (plan.price_cents / 100).toString()).replace(',', '.')) * 100)
    const { data: m, error } = await supabase.from('memberships').insert({ user_id: c.id, plan_id: plan.id, plan_name: plan.name, start_date: start, price_cents: cents, discount_code: code || null }).select().single()
    if (error) {
      setBusy(false)
      return toast.error(errMsg(error))
    }
    await supabase.from('payments').insert({ user_id: c.id, membership_id: m.id, description: plan.name, amount_cents: cents, method, status: paid ? 'paid' : 'pending', paid_at: paid ? new Date().toISOString() : null, due_date: paid ? null : start })
    await supabase.from('notifications').insert({ user_id: c.id, title: 'Abbonamento attivato 🎉', body: `${plan.name} dal ${fmtDate(start)}. Buon allenamento!`, kind: 'membership', link: '/app/abbonamento' })
    setBusy(false)
    toast.success('Abbonamento attivato')
    onSaved()
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Nuovo abbonamento" footer={<Button block size="lg" loading={busy} onClick={save}>Attiva abbonamento</Button>}>
      <div className="space-y-3">
        <div className="grid gap-2">
          {(plans ?? []).map((p) => (
            <button key={p.id} onClick={() => { setPlanId(p.id); setPrice((p.price_cents / 100).toFixed(2)) }} className={`flex items-center justify-between rounded-2xl border p-3 text-left transition ${planId === p.id ? 'border-gold bg-gold/10' : 'border-line'}`}>
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-muted">{p.kind === 'entries' ? `${p.entries} ingressi` : `${p.duration_days} giorni`}</div>
              </div>
              <div className="font-display text-2xl">{euro(p.price_cents)}</div>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Inizio">
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </Field>
          <Field label="Prezzo €">
            <Input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
        </div>
        <Field label="Codice sconto">
          <div className="flex gap-2">
            <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <Button variant="outline" className="shrink-0" onClick={applyCode}>
              Applica
            </Button>
          </div>
        </Field>
        <Toggle label="Già pagato" desc="Altrimenti viene registrato come pagamento in sospeso" checked={paid} onChange={setPaid} />
        {paid && (
          <Field label="Metodo">
            <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}>
              {Object.entries(methodLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
    </Sheet>
  )
}

function PaymentSheet({ target, onClose, c, onSaved }: { target: Membership | null | 'free'; onClose: () => void; c: Profile; onSaved: () => void }) {
  const m = target && target !== 'free' ? target : null
  const [desc, setDesc] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [paid, setPaid] = useState(true)
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    const cents = Math.round(Number(amount.replace(',', '.')) * 100)
    if (!cents) return toast.error('Importo non valido')
    setBusy(true)
    const { error } = await supabase.from('payments').insert({ user_id: c.id, membership_id: m?.id ?? null, description: desc || m?.plan_name || 'Pagamento', amount_cents: cents, method, status: paid ? 'paid' : 'pending', paid_at: paid ? new Date().toISOString() : null, due_date: paid ? null : due || null })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success(paid ? 'Incasso registrato' : 'Rata registrata')
    setAmount('')
    setDesc('')
    onSaved()
    onClose()
  }
  return (
    <Sheet open={!!target} onClose={onClose} title="Registra pagamento" footer={<Button block size="lg" loading={busy} onClick={save}>Salva</Button>}>
      <div className="space-y-3">
        <Field label="Descrizione">
          <Input value={desc} placeholder={m?.plan_name ?? 'Es. Rata 2/3, Personal x5, Iscrizione'} onChange={(e) => setDesc(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Importo €">
            <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
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
        <Toggle label="Incassato ora" desc="Disattiva per registrare una rata futura con scadenza" checked={paid} onChange={setPaid} />
        {!paid && (
          <Field label="Scadenza rata">
            <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
          </Field>
        )}
      </div>
    </Sheet>
  )
}

function SuspendSheet({ m, onClose, onSaved }: { m: Membership | null; onClose: () => void; onSaved: () => void }) {
  const [from, setFrom] = useState(isoDate())
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('Infortunio')
  async function save() {
    if (!m || !to) return toast.error('Scegli le date')
    const { error } = await supabase.from('memberships').update({ status: 'suspended', suspended_from: from, suspended_to: to, notes: reason }).eq('id', m.id)
    if (error) return toast.error(errMsg(error))
    toast.success('Abbonamento sospeso: la scadenza è stata allungata')
    onSaved()
    onClose()
  }
  return (
    <Sheet open={!!m} onClose={onClose} title="Sospendi" footer={<Button block size="lg" onClick={save}>Sospendi abbonamento</Button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Dal">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Al">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
        </div>
        <Field label="Motivo">
          <Select value={reason} onChange={(e) => setReason(e.target.value)}>
            <option>Infortunio</option>
            <option>Vacanza</option>
            <option>Motivi di lavoro</option>
            <option>Altro</option>
          </Select>
        </Field>
        <p className="text-xs text-muted">I giorni di sospensione vengono aggiunti automaticamente alla scadenza.</p>
      </div>
    </Sheet>
  )
}

/* ---------- SCHEDE ---------- */
function PlansTab({ c }: { c: Profile }) {
  const { profile } = useAuth()
  const [editing, setEditing] = useState<WorkoutPlan | 'new' | null>(null)
  const [fromTpl, setFromTpl] = useState(false)
  const { data, reload } = useAsync(async () => {
    const { data } = await supabase.from('workout_plans').select('*, workout_plan_items(*)').eq('user_id', c.id).order('created_at', { ascending: false })
    return (data as WorkoutPlan[]) ?? []
  }, [c.id])
  const { data: tpls } = useAsync(async () => {
    const { data } = await supabase.from('workout_plans').select('*, workout_plan_items(*)').eq('is_template', true).order('title')
    return (data as WorkoutPlan[]) ?? []
  })

  async function assign(t: WorkoutPlan) {
    const { data: p, error } = await supabase.from('workout_plans').insert({ user_id: c.id, title: t.title, goal: t.goal, notes: t.notes, created_by: profile!.id }).select().single()
    if (error) return toast.error(errMsg(error))
    const items = (t.workout_plan_items ?? []).map(({ id: _id, plan_id: _p, ...rest }) => ({ ...rest, plan_id: p.id }))
    if (items.length) await supabase.from('workout_plan_items').insert(items)
    toast.success('Scheda assegnata: il cliente riceve una notifica')
    setFromTpl(false)
    reload()
  }

  if (editing) return <PlanEditor plan={editing === 'new' ? null : editing} userId={c.id} onDone={() => { setEditing(null); reload() }} />

  return (
    <div>
      <div className="flex gap-2">
        <Button block icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
          Nuova scheda
        </Button>
        <Button variant="outline" icon={<ClipboardList className="size-4" />} onClick={() => setFromTpl(true)}>
          Da modello
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {(data ?? []).length === 0 && <Empty icon={<ClipboardList className="size-7" />} title="Nessuna scheda" text="Crea una scheda o parti da un modello." />}
        {(data ?? []).map((p) => (
          <button key={p.id} onClick={() => setEditing(p)} className="card flex w-full items-center gap-3 p-4 text-left">
            <div className="flex-1">
              <div className="font-semibold">{p.title}</div>
              <div className="text-xs text-muted">
                {p.workout_plan_items?.length ?? 0} esercizi · dal {fmtDate(p.starts_on)}
              </div>
            </div>
            <Badge tone={p.is_active ? 'green' : 'gray'}>{p.is_active ? 'Attiva' : 'Archiviata'}</Badge>
          </button>
        ))}
      </div>
      <Sheet open={fromTpl} onClose={() => setFromTpl(false)} title="Scegli un modello">
        <div className="space-y-2">
          {(tpls ?? []).length === 0 && <p className="text-sm text-muted">Nessun modello. Creane uno in "Schede ed esercizi".</p>}
          {(tpls ?? []).map((t) => (
            <button key={t.id} onClick={() => assign(t)} className="card flex w-full items-center justify-between p-4 text-left">
              <div>
                <div className="font-semibold">{t.title}</div>
                <div className="text-xs text-muted">
                  {t.goal} · {t.workout_plan_items?.length ?? 0} esercizi
                </div>
              </div>
              <Plus className="size-5 text-gold" />
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

/* ---------- MISURE ---------- */
function MeasuresTab({ c }: { c: Profile }) {
  const [open, setOpen] = useState(false)
  const [k, setK] = useState(0)
  return (
    <div>
      <Button block icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
        Nuova misurazione
      </Button>
      <div className="mt-2" key={k}>
        <ProgressTab userId={c.id} readOnly />
      </div>
      <MeasureSheet open={open} onClose={() => setOpen(false)} userId={c.id} onSaved={() => setK(k + 1)} />
    </div>
  )
}

/* ---------- PRESENZE ---------- */
function AttendanceTab({ c }: { c: Profile }) {
  const { data, loading } = useAsync(async () => {
    const [ci, bk] = await Promise.all([
      supabase.from('checkins').select('*').eq('user_id', c.id).order('checked_at', { ascending: false }).limit(60),
      supabase.from('bookings').select('status, created_at, sessions(title, starts_at)').eq('user_id', c.id).order('created_at', { ascending: false }).limit(40),
    ])
    return {
      checkins: (ci.data as { id: string; checked_at: string; allowed: boolean; reason: string | null }[]) ?? [],
      bookings: (bk.data as unknown as { status: string; sessions: { title: string; starts_at: string } | null }[]) ?? [],
    }
  }, [c.id])
  if (loading || !data) return <Loading />
  const month = data.checkins.filter((x) => x.allowed && new Date(x.checked_at) > new Date(Date.now() - 30 * 86400000)).length
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <div className="label">Ingressi 30 gg</div>
          <div className="font-display text-4xl">{month}</div>
        </div>
        <div className="card p-4">
          <div className="label">Ultimo ingresso</div>
          <div className="mt-1 font-semibold">{data.checkins[0] ? fmtRelative(data.checkins[0].checked_at) : 'Mai'}</div>
        </div>
      </div>
      <SectionTitle>
        <span className="flex items-center gap-2">
          <CalendarCheck className="size-5 text-gold" /> Prenotazioni
        </span>
      </SectionTitle>
      <div className="space-y-1.5">
        {data.bookings.map((b, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl bg-surface/50 px-3 py-2 text-sm">
            <span>
              {b.sessions?.title} <span className="text-muted">· {fmtDate(b.sessions?.starts_at, 'd MMM HH:mm')}</span>
            </span>
            <Badge tone={b.status === 'attended' ? 'green' : b.status === 'no_show' ? 'red' : 'gray'}>{bookingLabel[b.status]}</Badge>
          </div>
        ))}
      </div>
      <SectionTitle>Check-in</SectionTitle>
      <div className="space-y-1.5">
        {data.checkins.map((x) => (
          <div key={x.id} className="flex items-center justify-between rounded-xl bg-surface/50 px-3 py-2 text-sm">
            <span>{fmtDate(x.checked_at, 'EEE d MMM · HH:mm')}</span>
            {x.allowed ? <Badge tone="green">OK</Badge> : <Badge tone="red">{x.reason}</Badge>}
          </div>
        ))}
        {data.checkins.length === 0 && <p className="text-sm text-muted">Nessun ingresso.</p>}
      </div>
    </div>
  )
}
