import { addDays, format, isSameDay, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarX2, Clock, MapPin, User, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge, Button, Chips, Empty, Loading, PageHeader, Sheet } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { bookingLabel, fmtDay, fmtTime } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { errMsg, supabase } from '../../lib/supabase'
import type { SessionRow } from '../../lib/types'

type Filter = 'all' | 'course' | 'event' | 'mine'

export default function ClientCalendar() {
  const { settings } = useAuth()
  const [day, setDay] = useState(startOfDay(new Date()))
  const [filter, setFilter] = useState<Filter>('all')
  const [sel, setSel] = useState<SessionRow | null>(null)
  const [busy, setBusy] = useState(false)
  const days = useMemo(() => Array.from({ length: 21 }, (_, i) => addDays(startOfDay(new Date()), i)), [])

  const { data, loading, reload } = useAsync(async () => {
    const from = startOfDay(new Date())
    const { data, error } = await supabase.rpc('get_sessions', { p_from: from.toISOString(), p_to: addDays(from, 22).toISOString() })
    if (error) throw error
    return (data as SessionRow[]) ?? []
  })

  const { data: closures } = useAsync(async () => {
    const { data } = await supabase.from('closures').select('day, reason').gte('day', format(new Date(), 'yyyy-MM-dd'))
    return (data as { day: string; reason: string }[]) ?? []
  })

  const list = (data ?? []).filter((s) => {
    if (filter === 'mine') return s.my_status === 'booked' || s.my_status === 'waitlist'
    if (!isSameDay(new Date(s.starts_at), day)) return false
    if (filter === 'course') return s.kind === 'course'
    if (filter === 'event') return s.kind === 'event'
    return true
  })
  const closure = closures?.find((c) => c.day === format(day, 'yyyy-MM-dd'))
  const hours = settings?.opening_hours.find((h) => h.day === day.getDay())

  async function book(s: SessionRow) {
    setBusy(true)
    const { data: st, error } = await supabase.rpc('book_session', { p_session: s.id })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success(st === 'booked' ? 'Posto prenotato! 💪' : "Sei in lista d'attesa: ti avvisiamo se si libera un posto")
    setSel(null)
    reload()
  }
  async function cancel(s: SessionRow) {
    setBusy(true)
    const { error } = await supabase.rpc('cancel_booking', { p_session: s.id })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Prenotazione disdetta')
    setSel(null)
    reload()
  }

  return (
    <div>
      <PageHeader title="Calendario" kicker="Corsi ed eventi" subtitle={filter !== 'mine' ? fmtDay(day) : 'Le tue prenotazioni'} />

      {/* Giorni */}
      {filter !== 'mine' && (
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {days.map((d) => {
            const active = isSameDay(d, day)
            const has = (data ?? []).some((s) => isSameDay(new Date(s.starts_at), d))
            return (
              <button key={d.toISOString()} onClick={() => setDay(d)} className={`relative flex w-14 shrink-0 flex-col items-center rounded-2xl py-2.5 transition ${active ? 'text-ink' : 'bg-surface/60 text-cream'}`}>
                {active && <motion.span layoutId="day-pill" className="absolute inset-0 rounded-2xl bg-gold" transition={{ type: 'spring', stiffness: 500, damping: 36 }} />}
                <span className="relative text-[10px] font-bold uppercase opacity-70">{format(d, 'EEE', { locale: it })}</span>
                <span className="relative font-display text-2xl leading-tight">{format(d, 'd')}</span>
                <span className={`relative size-1.5 rounded-full ${has ? (active ? 'bg-ink' : 'bg-gold') : 'bg-transparent'}`} />
              </button>
            )
          })}
        </div>
      )}

      <Chips<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'Tutto' },
          { value: 'course', label: 'Corsi' },
          { value: 'event', label: 'Eventi' },
          { value: 'mine', label: 'Le mie' },
        ]}
      />

      {filter !== 'mine' && (
        <div className="mt-4 flex items-center gap-2 text-xs text-muted">
          <Clock className="size-3.5" />
          {closure ? <span className="text-danger">Chiuso: {closure.reason}</span> : hours?.open ? `Sala aperta ${hours.open} – ${hours.close}` : 'Palestra chiusa'}
        </div>
      )}

      <div className="mt-4 space-y-3">
        {loading ? (
          <Loading rows={4} />
        ) : list.length === 0 ? (
          <Empty icon={<CalendarX2 className="size-7" />} title="Niente in programma" text={filter === 'mine' ? 'Non hai prenotazioni attive.' : 'Prova un altro giorno o guarda gli eventi.'} />
        ) : (
          <AnimatePresence mode="popLayout">
            {list.map((s, i) => {
              const full = s.booked_count >= s.capacity
              const pct = Math.min(1, s.booked_count / Math.max(1, s.capacity))
              return (
                <motion.button
                  layout
                  key={s.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSel(s)}
                  className={`card relative flex w-full items-stretch gap-4 overflow-hidden p-0 text-left ${s.is_cancelled ? 'opacity-50' : ''}`}
                >
                  <span className="w-1.5 shrink-0" style={{ background: s.color }} />
                  <div className="flex w-16 shrink-0 flex-col justify-center py-4">
                    <div className="font-display text-2xl leading-none">{fmtTime(s.starts_at)}</div>
                    <div className="text-[11px] text-muted">{fmtTime(s.ends_at)}</div>
                    {filter === 'mine' && <div className="mt-1 text-[10px] uppercase text-gold">{format(new Date(s.starts_at), 'EEE d', { locale: it })}</div>}
                  </div>
                  <div className="min-w-0 flex-1 py-4 pr-4">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold">{s.title}</span>
                      {s.kind === 'event' && <Badge tone="red">Evento</Badge>}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted">{s.trainer_name ?? 'Staff'} · {s.room}</div>
                    <div className="mt-2.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                        <motion.div className={`h-full rounded-full ${full ? 'bg-danger' : 'bg-gold'}`} initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ duration: 0.8, delay: 0.1 + i * 0.04 }} />
                      </div>
                      <span className="text-[11px] tabular-nums text-muted">
                        {s.booked_count}/{s.capacity}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center pr-4">
                    {s.is_cancelled ? (
                      <Badge tone="red">Annullato</Badge>
                    ) : s.my_status && s.my_status !== 'cancelled' ? (
                      <Badge tone={s.my_status === 'booked' || s.my_status === 'attended' ? 'green' : 'gold'}>{bookingLabel[s.my_status]}</Badge>
                    ) : full ? (
                      <Badge tone="gold">Lista attesa</Badge>
                    ) : (
                      <Badge tone="blue">{s.capacity - s.booked_count} posti</Badge>
                    )}
                  </div>
                </motion.button>
              )
            })}
          </AnimatePresence>
        )}
      </div>

      <Sheet
        open={!!sel}
        onClose={() => setSel(null)}
        title={sel?.title}
        footer={
          sel && !sel.is_cancelled && new Date(sel.starts_at) > new Date() ? (
            sel.my_status === 'booked' || sel.my_status === 'waitlist' ? (
              <Button variant="danger" block size="lg" loading={busy} onClick={() => cancel(sel)}>
                {sel.my_status === 'waitlist' ? "Esci dalla lista d'attesa" : 'Disdici prenotazione'}
              </Button>
            ) : (
              <Button block size="lg" loading={busy} onClick={() => book(sel)}>
                {sel.booked_count >= sel.capacity ? "Entra in lista d'attesa" : 'Prenota il posto'}
              </Button>
            )
          ) : undefined
        }
      >
        {sel && (
          <div className="space-y-4">
            <div className="h-2 w-16 rounded-full" style={{ background: sel.color }} />
            {sel.description && <p className="text-sm text-cream/80">{sel.description}</p>}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="card p-3">
                <Clock className="mb-1 size-4 text-gold" />
                {fmtDay(sel.starts_at)}
                <div className="font-semibold">
                  {fmtTime(sel.starts_at)} – {fmtTime(sel.ends_at)}
                </div>
              </div>
              <div className="card p-3">
                <User className="mb-1 size-4 text-gold" />
                Trainer
                <div className="font-semibold">{sel.trainer_name ?? 'Staff OldSchool'}</div>
              </div>
              <div className="card p-3">
                <MapPin className="mb-1 size-4 text-gold" />
                Dove
                <div className="font-semibold">{sel.room}</div>
              </div>
              <div className="card p-3">
                <Users className="mb-1 size-4 text-gold" />
                Posti
                <div className="font-semibold">
                  {sel.booked_count}/{sel.capacity}
                  {sel.waitlist_count > 0 && <span className="text-muted"> · {sel.waitlist_count} in attesa</span>}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted">Puoi disdire gratuitamente fino a {settings?.cancel_hours ?? 2} ore prima dell'inizio. Se si libera un posto, il primo in lista d'attesa viene prenotato in automatico e avvisato.</p>
          </div>
        )}
      </Sheet>
    </div>
  )
}
