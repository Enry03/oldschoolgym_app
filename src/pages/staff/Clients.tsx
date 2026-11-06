import { motion } from 'framer-motion'
import { Download, FileCheck2, Mail, MessageCircle, Phone, Plus, Search, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, Badge, Button, Chips, Empty, Field, Input, Loading, PageHeader, Select, Sheet } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { daysUntil, downloadCsv, fmtDate, fullName, isoDate, roleLabel } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { SUPABASE_URL, supabase } from '../../lib/supabase'
import type { Certificate, Membership, Profile } from '../../lib/types'

type Filter = 'tutti' | 'attivi' | 'scaduti' | 'scadenza' | 'certificato' | 'staff'

export interface ClientRow extends Profile {
  membership?: Membership
  cert?: Certificate
}

export function useClients() {
  return useAsync(async () => {
    const [p, m, c] = await Promise.all([
      supabase.from('profiles').select('*').order('first_name'),
      supabase.from('memberships').select('*').order('end_date', { ascending: false, nullsFirst: true }),
      supabase.from('medical_certificates').select('*').order('expires_on', { ascending: false }),
    ])
    const ms = (m.data as Membership[]) ?? []
    const cs = (c.data as Certificate[]) ?? []
    return ((p.data as Profile[]) ?? []).map((x) => ({
      ...x,
      membership: ms.find((y) => y.user_id === x.id && y.status === 'active') ?? ms.find((y) => y.user_id === x.id),
      cert: cs.find((y) => y.user_id === x.id),
    })) as ClientRow[]
  })
}

export const isActive = (m?: Membership) => !!m && m.status === 'active' && (!m.end_date || (daysUntil(m.end_date) ?? 0) >= 0)

export default function Clients() {
  const { isFront, profile } = useAuth()
  const [params] = useSearchParams()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>((params.get('filtro') as Filter) ?? 'tutti')
  const [add, setAdd] = useState(false)
  const { data, loading, reload } = useClients()

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (data ?? []).filter((c) => {
      if (filter === 'staff') {
        if (c.role === 'client') return false
      } else if (c.role !== 'client') return false
      if (profile?.role === 'trainer' && filter !== 'staff' && c.trainer_id !== profile.id) return false
      if (filter === 'attivi' && !isActive(c.membership)) return false
      if (filter === 'scaduti' && isActive(c.membership)) return false
      if (filter === 'scadenza') {
        const d = daysUntil(c.membership?.end_date)
        if (!isActive(c.membership) || d === null || d > 7) return false
      }
      if (filter === 'certificato') {
        const d = daysUntil(c.cert?.expires_on)
        if (d !== null && d > 30) return false
      }
      if (!s) return true
      return `${c.first_name} ${c.last_name} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(s)
    })
  }, [data, q, filter, profile])

  function exportCsv() {
    downloadCsv(
      `clienti-${isoDate()}.csv`,
      list.map((c) => ({
        Nome: c.first_name,
        Cognome: c.last_name,
        Email: c.email,
        Telefono: c.phone,
        'Data di nascita': c.birth_date,
        Abbonamento: c.membership?.plan_name,
        Scadenza: c.membership?.end_date,
        'Certificato fino al': c.cert?.expires_on,
        Marketing: c.consent_marketing ? 'Sì' : 'No',
        Iscritto: c.created_at.slice(0, 10),
      })),
    )
  }

  return (
    <div>
      <PageHeader
        title="Clienti"
        kicker={`${list.length} ${filter === 'staff' ? 'membri dello staff' : 'clienti'}`}
        right={
          isFront && (
            <div className="flex gap-2">
              <Button size="sm" variant="ghost" aria-label="Esporta CSV" onClick={exportCsv}>
                <Download className="size-4" />
              </Button>
              <Button size="sm" icon={<UserPlus className="size-4" />} onClick={() => setAdd(true)}>
                Nuovo
              </Button>
            </div>
          )
        }
      />
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input placeholder="Cerca per nome, email o telefono" value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
      </div>
      <Chips<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'tutti', label: 'Tutti' },
          { value: 'attivi', label: 'Attivi' },
          { value: 'scadenza', label: 'In scadenza' },
          { value: 'scaduti', label: 'Scaduti' },
          { value: 'certificato', label: 'Certificato' },
          { value: 'staff', label: 'Staff' },
        ]}
      />
      <div className="mt-4 space-y-2">
        {loading ? (
          <Loading rows={6} />
        ) : list.length === 0 ? (
          <Empty title="Nessun risultato" text="Prova a cambiare filtro o ricerca." />
        ) : (
          list.map((c, i) => {
            const left = daysUntil(c.membership?.end_date)
            const certLeft = daysUntil(c.cert?.expires_on)
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 12) * 0.025 } }}>
                <Link to={`/staff/clienti/${c.id}`} className="card flex items-center gap-3 p-3 transition hover:border-gold/40">
                  <Avatar p={c} size={46} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{fullName(c)}</div>
                    <div className="truncate text-xs text-muted">{c.role !== 'client' ? roleLabel[c.role] : c.membership ? `${c.membership.plan_name}${c.membership.end_date ? ` · fino al ${fmtDate(c.membership.end_date, 'd/M')}` : ''}` : 'Nessun abbonamento'}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {c.role === 'client' &&
                      (isActive(c.membership) ? left !== null && left <= 7 ? <Badge tone="gold">{left} gg</Badge> : <Badge tone="green">Attivo</Badge> : <Badge tone="red">Scaduto</Badge>)}
                    {c.role === 'client' && (certLeft === null || certLeft < 0) && (
                      <span className="flex items-center gap-1 text-[10px] text-danger">
                        <FileCheck2 className="size-3" /> cert.
                      </span>
                    )}
                  </div>
                </Link>
              </motion.div>
            )
          })
        )}
      </div>
      <NewClientSheet open={add} onClose={() => setAdd(false)} onSaved={reload} />
    </div>
  )
}

function NewClientSheet({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', phone: '', role: 'client' })
  const [busy, setBusy] = useState(false)
  const { isAdmin } = useAuth()
  async function save() {
    if (!f.first_name || !f.email) return toast.error('Nome ed email sono obbligatori')
    setBusy(true)
    const { data } = await supabase.auth.getSession()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-create-user`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session?.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...f, redirect_to: `${window.location.origin}/nuova-password` }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return toast.error(j.error ?? 'Errore nella creazione')
    toast.success('Cliente creato: riceverà un\'email per impostare la password')
    setF({ first_name: '', last_name: '', email: '', phone: '', role: 'client' })
    onSaved()
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Nuovo iscritto" footer={<Button block size="lg" loading={busy} onClick={save}>Crea e invia invito</Button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome">
            <Input value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
          </Field>
          <Field label="Cognome">
            <Input value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
          </Field>
        </div>
        <Field label="Email" hint="Riceverà un link per scegliere la password">
          <Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Telefono">
          <Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        {isAdmin && (
          <Field label="Ruolo">
            <Select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
              <option value="client">Cliente</option>
              <option value="trainer">Personal trainer</option>
              <option value="reception">Reception</option>
              <option value="admin">Amministratore</option>
            </Select>
          </Field>
        )}
      </div>
    </Sheet>
  )
}

export function ContactButtons({ c }: { c: Profile }) {
  return (
    <div className="flex gap-2">
      {c.phone && (
        <a href={`tel:${c.phone}`} className="grid size-10 place-items-center rounded-xl bg-white/5 text-gold" aria-label="Chiama">
          <Phone className="size-4" />
        </a>
      )}
      {c.phone && (
        <a href={`https://wa.me/${c.phone.replace(/\D/g, '').replace(/^3/, '393')}`} target="_blank" rel="noreferrer" className="grid size-10 place-items-center rounded-xl bg-white/5 text-success" aria-label="WhatsApp">
          <MessageCircle className="size-4" />
        </a>
      )}
      {c.email && (
        <a href={`mailto:${c.email}`} className="grid size-10 place-items-center rounded-xl bg-white/5 text-info" aria-label="Email">
          <Mail className="size-4" />
        </a>
      )}
      <Link to={`/staff/messaggi?con=${c.id}`} className="grid size-10 place-items-center rounded-xl bg-gold text-ink" aria-label="Chat in app">
        <Plus className="size-4" />
      </Link>
    </div>
  )
}
