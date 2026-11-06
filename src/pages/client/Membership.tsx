import { motion } from 'framer-motion'
import { CreditCard, Printer, Receipt } from 'lucide-react'
import { useState } from 'react'
import { Badge, Card, Empty, Loading, PageHeader, SectionTitle, Sheet, Button, Logo } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { daysUntil, euro, fmtDate, fullName, methodLabel } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { supabase } from '../../lib/supabase'
import type { Membership, Payment, Plan } from '../../lib/types'

export const statusBadge = (m: Membership) => {
  const left = daysUntil(m.end_date)
  if (m.status === 'suspended') return <Badge tone="blue">Sospeso</Badge>
  if (m.status === 'cancelled') return <Badge>Annullato</Badge>
  if (m.status === 'expired' || (left !== null && left < 0)) return <Badge tone="red">Scaduto</Badge>
  if (left !== null && left <= 7) return <Badge tone="gold">Scade tra {left} gg</Badge>
  return <Badge tone="green">Attivo</Badge>
}

export default function MembershipPage() {
  const { profile } = useAuth()
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const { data, loading } = useAsync(async () => {
    const [m, p, pl] = await Promise.all([
      supabase.from('memberships').select('*').eq('user_id', profile!.id).order('start_date', { ascending: false }),
      supabase.from('payments').select('*').eq('user_id', profile!.id).order('created_at', { ascending: false }),
      supabase.from('plans').select('*').eq('is_active', true).order('sort'),
    ])
    return { memberships: (m.data as Membership[]) ?? [], payments: (p.data as Payment[]) ?? [], plans: (pl.data as Plan[]) ?? [] }
  }, [profile?.id])

  if (loading || !data) return <Loading rows={4} />
  const current = data.memberships[0]

  return (
    <div>
      <PageHeader title="Abbonamento" back kicker="Stato e pagamenti" />
      {current ? (
        <motion.div initial={{ rotateY: -20, opacity: 0 }} animate={{ rotateY: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 120 }} className="grain relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-bright via-navy to-ink p-6" style={{ perspective: 800 }}>
          <div className="stripes absolute inset-0 opacity-30" />
          <div className="relative flex items-start justify-between">
            <div>
              <div className="label !text-gold">Membership card</div>
              <div className="mt-1 font-display text-4xl uppercase leading-none">{current.plan_name}</div>
            </div>
            <Logo size={56} />
          </div>
          <div className="relative mt-6 grid grid-cols-3 gap-3 text-sm">
            <div>
              <div className="text-[10px] uppercase text-white/60">Inizio</div>
              <div className="font-semibold">{fmtDate(current.start_date, 'd MMM yy')}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-white/60">Scadenza</div>
              <div className="font-semibold">{current.end_date ? fmtDate(current.end_date, 'd MMM yy') : '—'}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-white/60">Ingressi</div>
              <div className="font-semibold">{current.entries_left ?? '∞'}</div>
            </div>
          </div>
          <div className="relative mt-5 flex items-center justify-between">
            <span className="font-varsity text-sm tracking-widest text-white/80">{fullName(profile)}</span>
            {statusBadge(current)}
          </div>
          {current.status === 'suspended' && current.suspended_from && (
            <p className="relative mt-3 text-xs text-white/70">
              Sospeso dal {fmtDate(current.suspended_from)} al {fmtDate(current.suspended_to)}: la scadenza è stata posticipata.
            </p>
          )}
        </motion.div>
      ) : (
        <Empty icon={<CreditCard className="size-7" />} title="Nessun abbonamento" text="Passa in reception per scegliere il piano più adatto a te." />
      )}

      {data.payments.some((p) => p.status === 'pending') && (
        <Card className="mt-4 border-gold/50 bg-gold/10">
          <div className="font-semibold text-gold">Pagamento in sospeso</div>
          {data.payments
            .filter((p) => p.status === 'pending')
            .map((p) => (
              <div key={p.id} className="mt-1 flex justify-between text-sm">
                <span>
                  {p.description} {p.due_date && `· entro il ${fmtDate(p.due_date)}`}
                </span>
                <span className="font-bold">{euro(p.amount_cents)}</span>
              </div>
            ))}
        </Card>
      )}

      <SectionTitle>Pagamenti e ricevute</SectionTitle>
      {data.payments.filter((p) => p.status === 'paid').length === 0 ? (
        <p className="text-sm text-muted">Nessun pagamento registrato.</p>
      ) : (
        <div className="space-y-2">
          {data.payments
            .filter((p) => p.status === 'paid')
            .map((p) => (
              <button key={p.id} onClick={() => setReceipt(p)} className="card flex w-full items-center gap-3 p-3 text-left">
                <div className="grid size-10 place-items-center rounded-xl bg-success/15 text-success">
                  <Receipt className="size-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold">{p.description}</div>
                  <div className="text-xs text-muted">
                    {fmtDate(p.paid_at ?? p.created_at)} · {methodLabel[p.method]}
                  </div>
                </div>
                <div className="font-display text-xl">{euro(p.amount_cents)}</div>
              </button>
            ))}
        </div>
      )}

      {data.memberships.length > 1 && (
        <>
          <SectionTitle>Storico abbonamenti</SectionTitle>
          <div className="space-y-2">
            {data.memberships.slice(1).map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-2xl bg-surface/50 px-4 py-3 text-sm">
                <span>{m.plan_name}</span>
                <span className="text-muted">
                  {fmtDate(m.start_date, 'MMM yy')} → {fmtDate(m.end_date, 'MMM yy')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <SectionTitle>Listino</SectionTitle>
      <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2">
        {data.plans.map((p) => (
          <div key={p.id} className={`w-56 shrink-0 snap-start rounded-2xl p-4 ${p.highlight ? 'bg-gold text-ink' : 'card'}`}>
            <div className="font-varsity text-sm uppercase">{p.name}</div>
            <div className="mt-1 font-display text-4xl">{euro(p.price_cents)}</div>
            <p className={`mt-1 text-xs ${p.highlight ? 'text-ink/70' : 'text-muted'}`}>{p.description}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">I rinnovi si fanno in reception. Riceverai un avviso 7 giorni prima della scadenza.</p>

      <Sheet open={!!receipt} onClose={() => setReceipt(null)} title="Ricevuta" footer={<Button block icon={<Printer className="size-4" />} onClick={() => window.print()}>Stampa / salva PDF</Button>}>
        {receipt && (
          <div id="print-area" className="rounded-2xl bg-cream p-5 text-ink">
            <div className="flex items-center justify-between">
              <Logo size={54} />
              <div className="text-right text-xs">
                <div className="font-bold">Ricevuta n. {receipt.receipt_number}</div>
                <div>{fmtDate(receipt.paid_at ?? receipt.created_at)}</div>
              </div>
            </div>
            <div className="mt-4 text-sm">
              Ricevuto da <b>{fullName(profile)}</b>
            </div>
            <div className="mt-3 flex justify-between border-y border-ink/15 py-3 text-sm">
              <span>{receipt.description}</span>
              <b>{euro(receipt.amount_cents)}</b>
            </div>
            <div className="mt-2 text-xs text-ink/60">Metodo: {methodLabel[receipt.method]}. Documento non fiscale.</div>
          </div>
        )}
      </Sheet>
    </div>
  )
}
