import { addDays, addWeeks, format, isSameDay, startOfDay, startOfWeek } from 'date-fns'
import { it } from 'date-fns/locale'
import { motion } from 'framer-motion'
import { Ban, CalendarOff, Check, ChevronLeft, ChevronRight, Plus, UserX, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, Badge, Button, Empty, Field, Input, Loading, PageHeader, Segmented, Select, Sheet, Textarea } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { bookingLabel, fmtDate, fmtDay, fmtTime, fullName } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { errMsg, supabase } from '../../lib/supabase'
import type { BookingStatus, Course, SessionRow, StaffMember } from '../../lib/types'

export default function StaffCalendar() {
  const { isAdmin, isFront } = useAuth()
  const [tab, setTab] = useState<'agenda' | 'corsi' | 'chiusure'>('agenda')
  return (
    <div>
      <PageHeader title="Calendario" kicker="Lezioni, corsi ed eventi" />
      {(isAdmin || isFront) && (
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'agenda', label: 'Agenda' },
            ...(isAdmin ? [{ value: 'corsi' as const, label: 'Corsi' }] : []),
            { value: 'chiusure', label: 'Chiusure' },
          ]}
          className="mb-5"
        />
      )}
      {tab === 'agenda' && <Agenda />}
      {tab === 'corsi' && <CoursesAdmin />}
      {tab === 'chiusure' && <Closures />}
    </div>
  )
}

function Agenda() {
  const [params, setParams] = useSearchParams()
  const [week, setWeek] = useState(startOfWeek(new Date(), { weekStartsOn: 1 }))
  const [day, setDay] = useState(startOfDay(new Date()))
  const [create, setCreate] = useState(false)
  const { data, loading, reload } = useAsync(async () => {
    const { data, error } = await supabase.rpc('get_sessions', { p_from: week.toISOString(), p_to: addDays(week, 7).toISOString() })
    if (error) throw error
    return (data as SessionRow[]) ?? []
  }, [week.getTime()])
  const selId = params.get('sessione')
  const [sel, setSel] = useState<SessionRow | null>(null)
  useEffect(() => {
    if (selId && data) {
      const s = data.find((x) => x.id === selId)
      if (s) setSel(s)
    }
  }, [selId, data])
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i))
  const list = (data ?? []).filter((s) => isSameDay(new Date(s.starts_at), day))

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button aria-label="Settimana precedente" onClick={() => { const w = addWeeks(week, -1); setWeek(w); setDay(w) }} className="grid size-10 place-items-center rounded-full bg-white/5">
          <ChevronLeft className="size-5" />
        </button>
        <div className="text-sm font-semibold capitalize">
          {format(week, 'd MMM', { locale: it })} – {format(addDays(week, 6), 'd MMM yyyy', { locale: it })}
        </div>
        <button aria-label="Settimana successiva" onClick={() => { const w = addWeeks(week, 1); setWeek(w); setDay(w) }} className="grid size-10 place-items-center rounded-full bg-white/5">
          <ChevronRight className="size-5" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((d) => {
          const n = (data ?? []).filter((s) => isSameDay(new Date(s.starts_at), d)).length
          const active = isSameDay(d, day)
          return (
            <button key={d.toISOString()} onClick={() => setDay(d)} className={`relative flex flex-col items-center rounded-2xl py-2 ${active ? 'text-ink' : 'bg-surface/60'}`}>
              {active && <motion.span layoutId="sday" className="absolute inset-0 rounded-2xl bg-gold" />}
              <span className="relative text-[10px] font-bold uppercase opacity-70">{format(d, 'EEEEE', { locale: it })}</span>
              <span className="relative font-display text-xl">{format(d, 'd')}</span>
              <span className="relative text-[10px] font-semibold opacity-70">{n || ''}</span>
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm font-semibold capitalize text-muted">{fmtDay(day)}</div>
        <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreate(true)}>
          Nuova
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty title="Giornata libera" text="Aggiungi una lezione o un evento." />
        ) : (
          list.map((s) => (
            <button key={s.id} onClick={() => setSel(s)} className={`card flex w-full items-center gap-3 overflow-hidden p-0 text-left ${s.is_cancelled ? 'opacity-50' : ''}`}>
              <span className="w-1.5 self-stretch" style={{ background: s.color }} />
              <div className="w-14 py-3 font-display text-xl">{fmtTime(s.starts_at)}</div>
              <div className="min-w-0 flex-1 py-3">
                <div className="truncate font-semibold">{s.title}</div>
                <div className="text-xs text-muted">{s.trainer_name ?? 'Senza trainer'} · {s.room}</div>
              </div>
              <div className="pr-3 text-right">
                {s.is_cancelled ? <Badge tone="red">Annullata</Badge> : <Badge tone={s.booked_count >= s.capacity ? 'red' : 'gray'}>{s.booked_count}/{s.capacity}</Badge>}
                {s.waitlist_count > 0 && <div className="mt-1 text-[10px] text-gold">+{s.waitlist_count} attesa</div>}
              </div>
            </button>
          ))
        )}
      </div>
      <CreateSession open={create} onClose={() => setCreate(false)} day={day} onSaved={reload} />
      <SessionDetail s={sel} onClose={() => { setSel(null); if (selId) setParams({}) }} onChanged={reload} />
    </div>
  )
}

function CreateSession({ open, onClose, day, onSaved }: { open: boolean; onClose: () => void; day: Date; onSaved: () => void }) {
  const { profile, isFront } = useAuth()
  const { data: courses } = useAsync(async () => {
    const { data } = await supabase.from('courses').select('*').eq('is_active', true).order('name')
    return (data as Course[]) ?? []
  })
  const { data: trainers } = useAsync(async () => {
    const { data } = await supabase.rpc('get_staff')
    return (data as StaffMember[]) ?? []
  })
  const [f, setF] = useState({ kind: 'course', course_id: '', title: '', description: '', date: format(day, 'yyyy-MM-dd'), time: '18:00', duration: 60, capacity: 15, trainer_id: '', room: 'Sala principale', repeat: 1 })
  const [busy, setBusy] = useState(false)
  useEffect(() => setF((x) => ({ ...x, date: format(day, 'yyyy-MM-dd'), trainer_id: x.trainer_id || (isFront ? '' : profile?.id ?? '') })), [day, isFront, profile?.id])

  function pickCourse(id: string) {
    const c = courses?.find((x) => x.id === id)
    setF({ ...f, course_id: id, title: c?.name ?? f.title, duration: c?.duration_min ?? f.duration, capacity: c?.capacity ?? f.capacity, trainer_id: c?.trainer_id ?? f.trainer_id })
  }

  async function save() {
    if (!f.title) return toast.error('Inserisci un titolo')
    setBusy(true)
    const rows = Array.from({ length: Math.max(1, Math.min(52, f.repeat)) }, (_, i) => {
      const start = addWeeks(new Date(`${f.date}T${f.time}:00`), i)
      return {
        kind: f.kind,
        course_id: f.kind === 'course' ? f.course_id || null : null,
        title: f.title,
        description: f.description || null,
        starts_at: start.toISOString(),
        ends_at: new Date(start.getTime() + f.duration * 60000).toISOString(),
        capacity: f.capacity,
        trainer_id: f.trainer_id || null,
        room: f.room,
      }
    })
    const { error } = await supabase.from('sessions').insert(rows)
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success(rows.length > 1 ? `${rows.length} lezioni create` : 'Lezione creata')
    onSaved()
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Nuova in calendario" footer={<Button block size="lg" loading={busy} onClick={save}>Crea</Button>}>
      <div className="space-y-3">
        <Segmented
          value={f.kind as 'course' | 'event' | 'personal'}
          onChange={(v) => setF({ ...f, kind: v })}
          options={[
            { value: 'course', label: 'Corso' },
            { value: 'event', label: 'Evento' },
            { value: 'personal', label: 'Personal' },
          ]}
        />
        {f.kind === 'course' && (
          <Field label="Corso">
            <Select value={f.course_id} onChange={(e) => pickCourse(e.target.value)}>
              <option value="">Scegli…</option>
              {(courses ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Titolo">
          <Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data">
            <Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
          <Field label="Ora">
            <Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} />
          </Field>
          <Field label="Durata (min)">
            <Input inputMode="numeric" value={f.duration} onChange={(e) => setF({ ...f, duration: Number(e.target.value) || 60 })} />
          </Field>
          <Field label="Posti">
            <Input inputMode="numeric" value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) || 1 })} />
          </Field>
        </div>
        <Field label="Trainer">
          <Select value={f.trainer_id} disabled={!isFront} onChange={(e) => setF({ ...f, trainer_id: e.target.value })}>
            <option value="">Nessuno</option>
            {(trainers ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {fullName(t)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sala">
          <Input value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} />
        </Field>
        <Field label="Ripeti ogni settimana per" hint="1 = solo questa volta">
          <Select value={f.repeat} onChange={(e) => setF({ ...f, repeat: Number(e.target.value) })}>
            {[1, 4, 8, 12, 26, 52].map((n) => (
              <option key={n} value={n}>
                {n === 1 ? 'Solo questa volta' : `${n} settimane`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Descrizione">
          <Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
      </div>
    </Sheet>
  )
}

interface Attendee {
  id: string
  status: BookingStatus
  user_id: string
  profiles: { first_name: string; last_name: string; avatar_url: string | null } | null
}

function SessionDetail({ s, onClose, onChanged }: { s: SessionRow | null; onClose: () => void; onChanged: () => void }) {
  const { isFront } = useAuth()
  const { data, reload } = useAsync(async () => {
    if (!s) return []
    const { data } = await supabase.from('bookings').select('id, status, user_id, profiles!bookings_user_id_fkey(first_name, last_name, avatar_url)').eq('session_id', s.id).neq('status', 'cancelled').order('created_at')
    return (data as unknown as Attendee[]) ?? []
  }, [s?.id])

  async function setStatus(a: Attendee, status: BookingStatus) {
    const { error } = await supabase.from('bookings').update({ status, updated_at: new Date().toISOString() }).eq('id', a.id)
    if (error) return toast.error(errMsg(error))
    reload()
  }
  async function cancelSession() {
    if (!s || !confirm('Annullare la lezione? I prenotati verranno avvisati.')) return
    const { error } = await supabase.from('sessions').update({ is_cancelled: true }).eq('id', s.id)
    if (error) return toast.error(errMsg(error))
    const users = (data ?? []).map((a) => a.user_id)
    if (users.length) {
      await supabase.from('notifications').insert(users.map((u) => ({ user_id: u, title: 'Lezione annullata ❌', body: `${s.title} del ${fmtDate(s.starts_at, 'd/M HH:mm')} è stata annullata. Ci scusiamo!`, kind: 'booking', link: '/app/calendario' })))
    }
    toast.success('Lezione annullata e iscritti avvisati')
    onChanged()
    onClose()
  }
  async function del() {
    if (!s || !confirm('Eliminare definitivamente la lezione?')) return
    await supabase.from('sessions').delete().eq('id', s.id)
    onChanged()
    onClose()
  }

  return (
    <Sheet open={!!s} onClose={onClose} title={s?.title}>
      {s && (
        <div>
          <div className="text-sm text-muted">
            {fmtDay(s.starts_at)} · {fmtTime(s.starts_at)}–{fmtTime(s.ends_at)} · {s.trainer_name ?? 'Senza trainer'}
          </div>
          <div className="mt-4 flex items-center justify-between">
            <span className="label">Iscritti ({(data ?? []).filter((a) => a.status !== 'waitlist').length}/{s.capacity})</span>
          </div>
          <div className="mt-2 space-y-2">
            {(data ?? []).length === 0 && <p className="text-sm text-muted">Nessun prenotato.</p>}
            {(data ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-surface/60 p-2.5">
                <Avatar p={a.profiles} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{fullName(a.profiles)}</div>
                  <div className="text-[11px] text-muted">{bookingLabel[a.status]}</div>
                </div>
                {a.status !== 'waitlist' && (
                  <>
                    <button aria-label="Presente" onClick={() => setStatus(a, 'attended')} className={`grid size-9 place-items-center rounded-xl ${a.status === 'attended' ? 'bg-success text-ink' : 'bg-white/5 text-success'}`}>
                      <Check className="size-4" />
                    </button>
                    <button aria-label="Assente" onClick={() => setStatus(a, 'no_show')} className={`grid size-9 place-items-center rounded-xl ${a.status === 'no_show' ? 'bg-danger text-white' : 'bg-white/5 text-danger'}`}>
                      <UserX className="size-4" />
                    </button>
                  </>
                )}
                {isFront && (
                  <button aria-label="Rimuovi" onClick={() => setStatus(a, 'cancelled')} className="grid size-9 place-items-center rounded-xl bg-white/5 text-muted">
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {!s.is_cancelled && (
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="danger" icon={<Ban className="size-4" />} onClick={cancelSession}>
                Annulla lezione
              </Button>
              {isFront && (
                <Button variant="ghost" onClick={del}>
                  Elimina
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

function CoursesAdmin() {
  const [edit, setEdit] = useState<Partial<Course> | null>(null)
  const { data, reload } = useAsync(async () => {
    const { data } = await supabase.from('courses').select('*').order('name')
    return (data as Course[]) ?? []
  })
  const { data: trainers } = useAsync(async () => {
    const { data } = await supabase.rpc('get_staff')
    return (data as StaffMember[]) ?? []
  })
  async function save() {
    if (!edit?.name) return toast.error('Nome obbligatorio')
    const row = { name: edit.name, description: edit.description ?? null, color: edit.color ?? '#F5C518', level: edit.level ?? 'Tutti i livelli', duration_min: edit.duration_min ?? 60, capacity: edit.capacity ?? 15, trainer_id: edit.trainer_id || null, is_active: edit.is_active ?? true }
    const { error } = edit.id ? await supabase.from('courses').update(row).eq('id', edit.id) : await supabase.from('courses').insert(row)
    if (error) return toast.error(errMsg(error))
    toast.success('Corso salvato')
    setEdit(null)
    reload()
  }
  return (
    <div>
      <Button block icon={<Plus className="size-4" />} onClick={() => setEdit({ color: '#F5C518', duration_min: 60, capacity: 15, is_active: true })}>
        Nuovo corso
      </Button>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {(data ?? []).map((c) => (
          <button key={c.id} onClick={() => setEdit(c)} className={`card flex items-center gap-3 p-4 text-left ${!c.is_active ? 'opacity-50' : ''}`}>
            <span className="size-10 shrink-0 rounded-xl" style={{ background: c.color }} />
            <div className="flex-1">
              <div className="font-semibold">{c.name}</div>
              <div className="text-xs text-muted">
                {c.duration_min} min · {c.capacity} posti · {c.level}
              </div>
            </div>
          </button>
        ))}
      </div>
      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Modifica corso' : 'Nuovo corso'} footer={<Button block size="lg" onClick={save}>Salva</Button>}>
        {edit && (
          <div className="space-y-3">
            <Field label="Nome">
              <Input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <Field label="Descrizione">
              <Textarea value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Durata">
                <Input inputMode="numeric" value={edit.duration_min ?? ''} onChange={(e) => setEdit({ ...edit, duration_min: Number(e.target.value) })} />
              </Field>
              <Field label="Posti">
                <Input inputMode="numeric" value={edit.capacity ?? ''} onChange={(e) => setEdit({ ...edit, capacity: Number(e.target.value) })} />
              </Field>
              <Field label="Colore">
                <Input type="color" value={edit.color ?? '#F5C518'} onChange={(e) => setEdit({ ...edit, color: e.target.value })} className="h-12 !p-1" />
              </Field>
            </div>
            <Field label="Livello">
              <Select value={edit.level ?? ''} onChange={(e) => setEdit({ ...edit, level: e.target.value })}>
                {['Tutti i livelli', 'Principiante', 'Intermedio', 'Avanzato'].map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </Select>
            </Field>
            <Field label="Trainer di riferimento">
              <Select value={edit.trainer_id ?? ''} onChange={(e) => setEdit({ ...edit, trainer_id: e.target.value })}>
                <option value="">Nessuno</option>
                {(trainers ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {fullName(t)}
                  </option>
                ))}
              </Select>
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-[#F5C518]" checked={edit.is_active ?? true} onChange={(e) => setEdit({ ...edit, is_active: e.target.checked })} /> Corso attivo
            </label>
          </div>
        )}
      </Sheet>
    </div>
  )
}

function Closures() {
  const [day, setDay] = useState('')
  const [reason, setReason] = useState('Festività')
  const { data, reload } = useAsync(async () => {
    const { data } = await supabase.from('closures').select('*').order('day', { ascending: false }).limit(50)
    return (data as { id: string; day: string; reason: string }[]) ?? []
  })
  async function add() {
    if (!day) return toast.error('Scegli il giorno')
    const { error } = await supabase.from('closures').insert({ day, reason })
    if (error) return toast.error(errMsg(error))
    toast.success('Chiusura aggiunta: le prenotazioni per quel giorno sono bloccate')
    setDay('')
    reload()
  }
  return (
    <div>
      <div className="card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Giorno">
            <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
          </Field>
          <Field label="Motivo">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
        </div>
        <Button block icon={<CalendarOff className="size-4" />} onClick={add}>
          Aggiungi chiusura
        </Button>
      </div>
      <div className="mt-4 space-y-2">
        {(data ?? []).map((c) => (
          <div key={c.id} className="card flex items-center justify-between p-3">
            <div>
              <div className="font-semibold capitalize">{fmtDate(c.day, 'EEEE d MMMM yyyy')}</div>
              <div className="text-xs text-muted">{c.reason}</div>
            </div>
            <button
              aria-label="Rimuovi"
              onClick={async () => {
                await supabase.from('closures').delete().eq('id', c.id)
                reload()
              }}
              className="text-muted hover:text-danger"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
