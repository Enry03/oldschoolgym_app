import { AnimatePresence, m } from 'motion/react'
import { Award, Check, ClipboardList, Dumbbell, FileDown, ImagePlus, Lock, Pause, Play, Plus, Target, Timer, Trash2, Trophy, Users } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ExerciseDetails, ExerciseThumb } from '../../components/ExerciseMedia'
import { Badge, Button, Card, Empty, Field, Input, Loading, PageHeader, SectionTitle, Segmented, Select, Sheet, Skeleton, Stat } from '../../components/ui'
import { BADGES } from '../../lib/badges'
import { useAuth } from '../../context/AuthContext'
import { fmtDate, isoDate } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { errMsg, signedUrl, supabase } from '../../lib/supabase'
import type { Goal, Measurement, PersonalRecord, ProgressPhoto, UserBadge, WorkoutItem, WorkoutLog, WorkoutPlan } from '../../lib/types'

const Charts = lazy(() => import('../../components/Charts'))

type Tab = 'scheda' | 'progressi' | 'traguardi'

export default function Training() {
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) ?? 'scheda'
  return (
    <div>
      <PageHeader title="Allenamento" kicker="La tua scheda e i tuoi numeri" />
      <Segmented<Tab>
        value={tab}
        onChange={(v) => setParams({ tab: v }, { replace: true })}
        options={[
          { value: 'scheda', label: 'Scheda' },
          { value: 'progressi', label: 'Progressi' },
          { value: 'traguardi', label: 'Traguardi' },
        ]}
        className="mb-5"
      />
      {tab === 'scheda' ? <PlanTab /> : tab === 'progressi' ? <ProgressTab /> : <BadgesGrid />}
    </div>
  )
}

/* ================= SCHEDA ================= */
function PlanTab() {
  const { profile } = useAuth()
  const { data: plans, loading } = useAsync(async () => {
    const { data } = await supabase.from('workout_plans').select('*, workout_plan_items(*, exercises(images, video_url, description, equipment))').eq('user_id', profile!.id).eq('is_active', true).order('created_at', { ascending: false })
    return (data as WorkoutPlan[]) ?? []
  }, [profile?.id])
  const { data: logs, reload: reloadLogs } = useAsync(async () => {
    const { data } = await supabase.from('workout_logs').select('*').eq('user_id', profile!.id).order('performed_on', { ascending: false }).order('set_number').limit(400)
    return (data as WorkoutLog[]) ?? []
  }, [profile?.id])
  const [planIdx, setPlanIdx] = useState(0)
  const plan = plans?.[planIdx]
  const days = useMemo(() => {
    const items = [...(plan?.workout_plan_items ?? [])].sort((a, b) => a.sort - b.sort)
    const map = new Map<string, WorkoutItem[]>()
    items.forEach((it) => map.set(it.day_label, [...(map.get(it.day_label) ?? []), it]))
    return [...map.entries()]
  }, [plan])
  const [day, setDay] = useState<string>('')
  useEffect(() => {
    if (days.length && !days.find(([d]) => d === day)) setDay(days[0][0])
  }, [days, day])
  const [logItem, setLogItem] = useState<WorkoutItem | null>(null)

  if (loading) return <Loading rows={4} />
  if (!plans?.length)
    return <Empty icon={<ClipboardList className="size-7" />} title="Nessuna scheda" text="Il tuo trainer non ti ha ancora assegnato una scheda. Chiedila in sala o scrivigli dall'app" />

  const today = isoDate()
  const items = days.find(([d]) => d === day)?.[1] ?? []
  const doneToday = new Set((logs ?? []).filter((l) => l.performed_on === today).map((l) => l.plan_item_id))

  return (
    <div>
      {plans.length > 1 && (
        <Select value={planIdx} onChange={(e) => setPlanIdx(Number(e.target.value))} className="mb-4">
          {plans.map((p, i) => (
            <option key={p.id} value={i}>
              {p.title}
            </option>
          ))}
        </Select>
      )}
      <m.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-line/50 bg-surface-2 p-4">
                <div className="relative">
          <Badge tone="gold">{plan?.goal ?? 'Scheda personale'}</Badge>
          <h2 className="mt-2 text-xl font-semibold leading-tight">{plan?.title}</h2>
          {plan?.notes && <p className="mt-2 text-sm text-cream/80">{plan.notes}</p>}
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted">
            <span>
              Dal {fmtDate(plan?.starts_on)} {plan?.ends_on ? `al ${fmtDate(plan.ends_on)}` : ''}
            </span>
            {plan && (
              <Link to={`/stampa/scheda/${plan.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 font-semibold text-cream hover:text-gold">
                <FileDown className="size-3.5" /> PDF
              </Link>
            )}
          </div>
        </div>
      </m.div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
        {days.map(([d]) => (
          <button key={d} onClick={() => setDay(d)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${d === day ? 'bg-gold text-ink' : 'bg-surface text-cream/80'}`}>
            {d}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-3">
        {items.map((it, i) => {
          const last = (logs ?? []).filter((l) => l.plan_item_id === it.id)
          const lastW = last.find((l) => l.weight_kg != null)?.weight_kg
          const done = doneToday.has(it.id)
          return (
            <m.button key={it.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 6) * 0.03, duration: 0.2 } }} whileTap={{ scale: 0.98 }} onClick={() => setLogItem(it)} className={`card flex w-full items-center gap-4 p-4 text-left ${done ? 'border-success/50' : ''}`}>
              <div className="relative shrink-0">
                <ExerciseThumb media={it.exercises} className="size-14" />
                <span className={`absolute -left-1.5 -top-1.5 grid size-6 place-items-center rounded-md text-xs font-semibold tabular-nums ${done ? 'bg-success text-ink' : 'bg-night text-cream'}`}>{done ? <Check className="size-3.5" /> : i + 1}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{it.exercise_name}</div>
                <div className="mt-0.5 text-sm text-muted">
                  {it.sets} × {it.reps} {it.rest_sec ? `· rec ${it.rest_sec}"` : ''}
                </div>
                {(it.load_note || it.notes) && <div className="mt-1 text-xs text-gold/90">{[it.load_note, it.notes].filter(Boolean).join(' · ')}</div>}
              </div>
              {lastW != null && (
                <div className="text-right">
                  <div className="font-display text-xl leading-none">{lastW}</div>
                  <div className="text-[11px] text-muted">kg ultimo</div>
                </div>
              )}
            </m.button>
          )
        })}
      </div>

      <LogSheet item={logItem} onClose={() => setLogItem(null)} logs={logs ?? []} onSaved={reloadLogs} />
    </div>
  )
}

function RestTimer({ seconds }: { seconds: number }) {
  const [left, setLeft] = useState(seconds)
  const [run, setRun] = useState(false)
  useEffect(() => setLeft(seconds), [seconds])
  useEffect(() => {
    if (!run) return
    const t = setInterval(() => setLeft((l) => {
      if (l <= 1) {
        setRun(false)
        try { navigator.vibrate?.([200, 100, 200]) } catch { /* */ }
        return seconds
      }
      return l - 1
    }), 1000)
    return () => clearInterval(t)
  }, [run, seconds])
  return (
    <button type="button" onClick={() => setRun(!run)} className="flex w-full items-center gap-3 rounded-2xl bg-night p-3">
      <Timer className="size-5 text-gold" />
      <span className="flex-1 text-left text-sm">Recupero</span>
      <span className="font-display text-2xl tabular-nums">
        {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
      </span>
      {run ? <Pause className="size-5" /> : <Play className="size-5" />}
    </button>
  )
}

function LogSheet({ item, onClose, logs, onSaved }: { item: WorkoutItem | null; onClose: () => void; logs: WorkoutLog[]; onSaved: () => void }) {
  const { profile } = useAuth()
  const [sets, setSets] = useState<{ weight: string; reps: string }[]>([])
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const today = isoDate()
  useEffect(() => {
    if (!item) return
    const lastDay = logs.find((l) => l.plan_item_id === item.id)?.performed_on
    const prev = logs.filter((l) => l.plan_item_id === item.id && l.performed_on === lastDay)
    setSets(Array.from({ length: Math.max(item.sets, prev.length) }, (_, i) => ({ weight: prev[i]?.weight_kg?.toString() ?? '', reps: prev[i]?.reps?.toString() ?? item.reps.replace(/\D.*/, '') })))
    setNote(lastDay === today ? (prev.find((l) => l.note)?.note ?? '') : '')
  }, [item, logs, today])
  const history = item ? logs.filter((l) => l.plan_item_id === item.id) : []
  const byDay = history.reduce<Record<string, WorkoutLog[]>>((acc, l) => ((acc[l.performed_on] ??= []).push(l), acc), {})
  const sameName = (l: WorkoutLog) => item && l.exercise_name.trim().toLowerCase() === item.exercise_name.trim().toLowerCase()
  const best = Math.max(0, ...logs.filter((l) => sameName(l) && l.performed_on < today && l.weight_kg != null).map((l) => Number(l.weight_kg)))
  const doneToday = history.some((l) => l.performed_on === today)

  const num = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null)
  async function save() {
    if (!item || !profile) return
    const rows = sets
      .map((s, i) => ({ user_id: profile.id, plan_item_id: item.id, exercise_name: item.exercise_name, performed_on: today, set_number: i + 1, weight_kg: num(s.weight), reps: num(s.reps), note: null as string | null }))
      .filter((r) => r.weight_kg != null || r.reps != null)
    if (!rows.length) return toast.error('Inserisci almeno una serie')
    if (rows.some((r) => (r.weight_kg != null && !(r.weight_kg >= 0 && r.weight_kg <= 1000)) || (r.reps != null && !(Number.isInteger(r.reps) && r.reps >= 0 && r.reps <= 1000))))
      return toast.error('Controlla i numeri: kg tra 0 e 1000, ripetizioni intere')
    rows[0].note = note.trim().slice(0, 500) || null
    setBusy(true)
    const del = await supabase.from('workout_logs').delete().eq('user_id', profile.id).eq('plan_item_id', item.id).eq('performed_on', today)
    const { error } = del.error ? del : await supabase.from('workout_logs').insert(rows)
    if (error) {
      setBusy(false)
      return toast.error(errMsg(error))
    }
    const { data: rec } = await supabase.from('personal_records').select('weight_kg, previous_kg').eq('user_id', profile.id).eq('exercise_key', item.exercise_name.trim().toLowerCase()).eq('achieved_on', today).maybeSingle()
    setBusy(false)
    if (rec) toast.success(`Nuovo record personale: ${rec.weight_kg} kg 🏆`, { description: rec.previous_kg != null ? `Prima era ${rec.previous_kg} kg` : undefined })
    else toast.success('Serie salvate')
    onSaved()
    onClose()
  }
  async function clearToday() {
    if (!item || !profile) return
    setBusy(true)
    const { error } = await supabase.from('workout_logs').delete().eq('user_id', profile.id).eq('plan_item_id', item.id).eq('performed_on', today)
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Serie di oggi cancellate')
    onSaved()
    onClose()
  }

  return (
    <Sheet open={!!item} onClose={onClose} title={item?.exercise_name} footer={<Button block size="lg" loading={busy} onClick={save}>Salva allenamento</Button>}>
      {item && (
        <div className="space-y-4">
          <ExerciseDetails media={item.exercises} name={item.exercise_name} />
          <div className="flex flex-wrap gap-2">
            <Badge tone="gold">{item.sets} serie</Badge>
            <Badge tone="blue">{item.reps} ripetizioni</Badge>
            {item.load_note && <Badge>{item.load_note}</Badge>}
            {best > 0 && (
              <Badge tone="green">
                <Trophy className="size-3" /> Record {best} kg
              </Badge>
            )}
          </div>
          {item.rest_sec ? <RestTimer seconds={item.rest_sec} /> : null}
          <div className="space-y-2">
            {sets.map((s, i) => (
              <m.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.04 } }} className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-night font-display text-lg">{i + 1}</span>
                <Input inputMode="decimal" placeholder="kg" value={s.weight} onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} />
                <Input inputMode="numeric" placeholder="reps" value={s.reps} onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))} />
              </m.div>
            ))}
            <button type="button" onClick={() => setSets([...sets, { weight: '', reps: '' }])} className="flex items-center gap-1 text-sm font-semibold text-gold">
              <Plus className="size-4" /> Aggiungi serie
            </button>
          </div>
          <Field label="Nota per il trainer (facoltativa)">
            <Input value={note} maxLength={500} placeholder="Es. fastidio alla spalla, ultima serie a cedimento" onChange={(e) => setNote(e.target.value)} />
          </Field>
          {doneToday && (
            <button type="button" disabled={busy} onClick={clearToday} className="flex items-center gap-1 text-sm text-muted hover:text-danger">
              <Trash2 className="size-4" /> Cancella le serie di oggi
            </button>
          )}
          {Object.keys(byDay).length > 0 && (
            <div>
              <div className="label mb-2">Storico</div>
              <div className="space-y-1.5">
                {Object.entries(byDay)
                  .slice(0, 6)
                  .map(([d, ls]) => (
                    <div key={d} className="flex justify-between rounded-xl bg-night px-3 py-2 text-sm">
                      <span className="text-muted">{fmtDate(d, 'd MMM')}</span>
                      <span className="tabular-nums">{ls.map((l) => `${l.weight_kg ?? '-'}×${l.reps ?? '-'}`).join('  ')}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

/* ================= PROGRESSI ================= */
const measureFields: { key: keyof Measurement; label: string; unit: string }[] = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg' },
  { key: 'body_fat_pct', label: 'Massa grassa', unit: '%' },
  { key: 'muscle_mass_kg', label: 'Massa magra', unit: 'kg' },
  { key: 'height_cm', label: 'Altezza', unit: 'cm' },
  { key: 'chest_cm', label: 'Petto', unit: 'cm' },
  { key: 'waist_cm', label: 'Vita', unit: 'cm' },
  { key: 'hips_cm', label: 'Fianchi', unit: 'cm' },
  { key: 'arm_cm', label: 'Braccio', unit: 'cm' },
  { key: 'thigh_cm', label: 'Coscia', unit: 'cm' },
]

export function ProgressTab({ userId, readOnly }: { userId?: string; readOnly?: boolean }) {
  const { profile } = useAuth()
  const uid = userId ?? profile?.id
  const isMe = uid === profile?.id
  const { data: ms, loading, reload } = useAsync(async () => {
    const { data } = await supabase.from('measurements').select('*').eq('user_id', uid!).order('measured_on')
    return (data as Measurement[]) ?? []
  }, [uid])
  const { data: logs } = useAsync(async () => {
    const { data } = await supabase.from('workout_logs').select('exercise_name, performed_on, weight_kg').eq('user_id', uid!).not('weight_kg', 'is', null).order('performed_on')
    return (data as Pick<WorkoutLog, 'exercise_name' | 'performed_on' | 'weight_kg'>[]) ?? []
  }, [uid])
  const { data: records } = useAsync(async () => {
    const { data } = await supabase.from('personal_records').select('*').eq('user_id', uid!).order('achieved_on', { ascending: false }).limit(30)
    return (data as PersonalRecord[]) ?? []
  }, [uid])
  const [open, setOpen] = useState(false)
  const [metric, setMetric] = useState<keyof Measurement>('weight_kg')
  const exercises = useMemo(() => [...new Set((logs ?? []).map((l) => l.exercise_name))], [logs])
  const [ex, setEx] = useState('')
  useEffect(() => {
    if (!ex && exercises.length) setEx(exercises[0])
  }, [exercises, ex])

  const last = ms?.[ms.length - 1]
  const first = ms?.[0]
  const delta = (k: keyof Measurement) => {
    const a = first?.[k] as number | null, b = last?.[k] as number | null
    if (a == null || b == null || ms!.length < 2) return null
    return Math.round((b - a) * 10) / 10
  }
  const bmi = last?.weight_kg && last?.height_cm ? (last.weight_kg / (last.height_cm / 100) ** 2).toFixed(1) : null

  const exSeries = useMemo(() => {
    const m = new Map<string, number>()
    ;(logs ?? []).filter((l) => l.exercise_name === ex).forEach((l) => m.set(l.performed_on, Math.max(m.get(l.performed_on) ?? 0, Number(l.weight_kg))))
    return [...m.entries()].map(([d, v]) => ({ x: fmtDate(d, 'd/M'), y: v }))
  }, [logs, ex])

  if (loading) return <Loading rows={3} />
  return (
    <div>
      <div className="grid grid-cols-2 gap-3">
        <Stat tone="gold" label="Peso attuale" value={last?.weight_kg ?? '—'} sub={delta('weight_kg') != null ? `${delta('weight_kg')! > 0 ? '+' : ''}${delta('weight_kg')} kg dall'inizio` : 'kg'} />
        <Stat label="Massa grassa" value={last?.body_fat_pct != null ? `${last.body_fat_pct}%` : '—'} sub={bmi ? `BMI ${bmi}` : 'Ultima misura'} />
      </div>

      <SectionTitle action={!readOnly && <Button size="sm" variant="ghost" icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>Misura</Button>}>Andamento</SectionTitle>
      <Card className="p-3">
        <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
          {measureFields.filter((f) => (ms ?? []).some((m) => m[f.key] != null)).map((f) => (
            <button key={f.key} onClick={() => setMetric(f.key)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${metric === f.key ? 'bg-gold text-ink' : 'bg-night text-muted'}`}>
              {f.label}
            </button>
          ))}
        </div>
        {(ms ?? []).length >= 1 ? (
          <Suspense fallback={<Skeleton className="h-48" />}>
            <Charts kind="area" data={(ms ?? []).filter((m) => m[metric] != null).map((m) => ({ x: fmtDate(m.measured_on, 'd/M'), y: Number(m[metric]) }))} unit={measureFields.find((f) => f.key === metric)?.unit} />
          </Suspense>
        ) : (
          <p className="py-10 text-center text-sm text-muted">Aggiungi la prima misurazione per vedere il grafico.</p>
        )}
      </Card>

      {last && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {measureFields.slice(3).map((f) => (
            <div key={f.key} className="rounded-2xl bg-surface/60 p-3 text-center">
              <div className="text-[11px] text-muted">{f.label}</div>
              <div className="font-display text-xl">{(last[f.key] as number | null) ?? '—'}</div>
              {delta(f.key) != null && <div className={`text-[10px] ${delta(f.key)! <= 0 ? 'text-success' : 'text-gold'}`}>{delta(f.key)! > 0 ? '+' : ''}{delta(f.key)}</div>}
            </div>
          ))}
        </div>
      )}

      {exercises.length > 0 && (
        <>
          <SectionTitle>Carichi per esercizio</SectionTitle>
          <Card className="p-3">
            <Select value={ex} onChange={(e) => setEx(e.target.value)} className="mb-3">
              {exercises.map((e) => (
                <option key={e}>{e}</option>
              ))}
            </Select>
            <Suspense fallback={<Skeleton className="h-48" />}>
              <Charts kind="line" data={exSeries} unit="kg" />
            </Suspense>
          </Card>
        </>
      )}

      {(records ?? []).length > 0 && <RecordsBlock records={records!} />}
      {isMe && !readOnly && <GoalsBlock />}
      {isMe && !readOnly ? <PhotosBlock /> : <SharedPhotos userId={uid!} />}

      <MeasureSheet open={open} onClose={() => setOpen(false)} userId={uid!} onSaved={reload} />
    </div>
  )
}

export function MeasureSheet({ open, onClose, userId, onSaved }: { open: boolean; onClose: () => void; userId: string; onSaved: () => void }) {
  const { profile } = useAuth()
  const [f, setF] = useState<Record<string, string>>({ measured_on: isoDate() })
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true)
    const row: Record<string, unknown> = { user_id: userId, created_by: profile!.id, measured_on: f.measured_on }
    measureFields.forEach((m) => {
      if (f[m.key]) row[m.key] = Number(String(f[m.key]).replace(',', '.'))
    })
    const { error } = await supabase.from('measurements').insert(row)
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Misurazione salvata')
    setF({ measured_on: isoDate() })
    onSaved()
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Nuova misura" footer={<Button block size="lg" loading={busy} onClick={save}>Salva</Button>}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Field label="Data">
            <Input type="date" value={f.measured_on} onChange={(e) => setF({ ...f, measured_on: e.target.value })} />
          </Field>
        </div>
        {measureFields.map((m) => (
          <Field key={m.key} label={`${m.label} (${m.unit})`}>
            <Input inputMode="decimal" value={f[m.key] ?? ''} onChange={(e) => setF({ ...f, [m.key]: e.target.value })} />
          </Field>
        ))}
      </div>
    </Sheet>
  )
}

function GoalsBlock() {
  const { profile } = useAuth()
  const { data: goals, reload } = useAsync(async () => {
    const { data } = await supabase.from('goals').select('*').eq('user_id', profile!.id).order('is_done').order('created_at', { ascending: false })
    return (data as Goal[]) ?? []
  }, [profile?.id])
  const [title, setTitle] = useState('')
  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    const { error } = await supabase.from('goals').insert({ user_id: profile!.id, title: title.trim() })
    if (error) return toast.error(errMsg(error))
    setTitle('')
    reload()
  }
  async function toggle(g: Goal) {
    await supabase.from('goals').update({ is_done: !g.is_done }).eq('id', g.id)
    if (!g.is_done) toast.success('Obiettivo raggiunto')
    reload()
  }
  async function remove(g: Goal) {
    await supabase.from('goals').delete().eq('id', g.id)
    reload()
  }
  return (
    <>
      <SectionTitle>Obiettivi</SectionTitle>
      <form onSubmit={add} className="mb-3 flex gap-2">
        <Input placeholder="Es. Panca piana 100 kg entro giugno" value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} />
        <Button type="submit" className="shrink-0" aria-label="Aggiungi obiettivo">
          <Target className="size-5" />
        </Button>
      </form>
      <div className="space-y-2">
        <AnimatePresence>
          {(goals ?? []).map((g) => (
            <m.div key={g.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="card flex items-center gap-3 p-3">
              <button onClick={() => toggle(g)} aria-label="Completa" className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition ${g.is_done ? 'border-success bg-success text-ink' : 'border-line'}`}>
                {g.is_done && <Check className="size-4" />}
              </button>
              <span className={`flex-1 text-sm ${g.is_done ? 'text-muted line-through' : ''}`}>{g.title}</span>
              <button onClick={() => remove(g)} aria-label="Elimina" className="text-muted hover:text-danger">
                <Trash2 className="size-4" />
              </button>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}

async function withUrls(rows: ProgressPhoto[]) {
  return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl('progress', r.file_path) })))
}

function PhotosBlock() {
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const { data: photos, reload } = useAsync(async () => {
    const { data } = await supabase.from('progress_photos').select('*').eq('user_id', profile!.id).order('taken_on', { ascending: false }).order('created_at', { ascending: false })
    return withUrls((data as ProgressPhoto[]) ?? [])
  }, [profile?.id])

  async function upload(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return toast.error('Formato non supportato: usa JPG, PNG o WebP')
    if (file.size > 10 * 1024 * 1024) return toast.error('Foto troppo grande (max 10 MB)')
    setBusy(true)
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${profile!.id}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('progress').upload(path, file, { contentType: file.type })
    if (up.error) {
      setBusy(false)
      return toast.error(errMsg(up.error))
    }
    const { error } = await supabase.from('progress_photos').insert({ user_id: profile!.id, file_path: path })
    setBusy(false)
    if (error) {
      await supabase.storage.from('progress').remove([path])
      return toast.error(errMsg(error))
    }
    toast.success('Foto salvata (la vedi solo tu)')
    reload()
  }
  async function remove(p: ProgressPhoto) {
    const { error } = await supabase.from('progress_photos').delete().eq('id', p.id)
    if (error) return toast.error(errMsg(error))
    await supabase.storage.from('progress').remove([p.file_path])
    reload()
  }
  async function toggleShare(p: ProgressPhoto) {
    const { error } = await supabase.from('progress_photos').update({ shared_with_coach: !p.shared_with_coach }).eq('id', p.id)
    if (error) return toast.error(errMsg(error))
    toast.success(p.shared_with_coach ? 'Foto di nuovo privata' : 'Ora la vede anche il tuo trainer')
    reload()
  }
  return (
    <>
      <SectionTitle>
        <span className="flex items-center gap-2">
          Foto progressi <Lock className="size-4 text-muted" />
        </span>
      </SectionTitle>
      {(photos ?? []).length >= 2 && <BeforeAfter photos={photos!} />}
      <div className="grid grid-cols-3 gap-2">
        <label className="grid aspect-[3/4] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-line text-muted hover:border-gold hover:text-gold">
          {busy ? <Dumbbell className="size-6 animate-spin motion-reduce:animate-none" /> : <ImagePlus className="size-7" />}
          <span className="sr-only">Aggiungi foto</span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
        </label>
        {(photos ?? []).map((p) => (
          <div key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface">
            {p.url && <img src={p.url} alt={`Foto del ${fmtDate(p.taken_on)}`} className="size-full object-cover" loading="lazy" />}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-1.5 text-[10px]">{fmtDate(p.taken_on, 'd MMM yy')}</span>
            <button onClick={() => toggleShare(p)} aria-pressed={p.shared_with_coach} aria-label={p.shared_with_coach ? 'Condivisa con il trainer: rendi privata' : 'Condividi con il trainer'} className={`absolute left-1.5 top-1.5 grid size-7 place-items-center rounded-full ${p.shared_with_coach ? 'bg-gold text-ink' : 'bg-black/60 text-white'}`}>
              <Users className="size-3.5" />
            </button>
            <button onClick={() => remove(p)} aria-label="Elimina foto" className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Le foto sono private. Tocca <Users className="inline size-3" /> su una foto per farla vedere al tuo trainer, e di nuovo per toglierla.
      </p>
    </>
  )
}

function SharedPhotos({ userId }: { userId: string }) {
  const { data: photos } = useAsync(async () => {
    const { data } = await supabase.from('progress_photos').select('*').eq('user_id', userId).order('taken_on', { ascending: false })
    return withUrls((data as ProgressPhoto[]) ?? [])
  }, [userId])
  return (
    <>
      <SectionTitle>Foto condivise dal cliente</SectionTitle>
      {!(photos ?? []).length ? (
        <p className="card p-4 text-sm text-muted">Nessuna foto condivisa. Le foto restano private finché il cliente non sceglie di mostrartele.</p>
      ) : (
        <>
          {photos!.length >= 2 && <BeforeAfter photos={photos!} />}
          <div className="grid grid-cols-3 gap-2">
            {photos!.map((p) => (
              <div key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface">
                {p.url && <img src={p.url} alt={`Foto del ${fmtDate(p.taken_on)}`} className="size-full object-cover" loading="lazy" />}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-1.5 text-[10px]">{fmtDate(p.taken_on, 'd MMM yy')}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}

/** Confronto prima/dopo: di base la foto più vecchia e la più recente */
function BeforeAfter({ photos }: { photos: ProgressPhoto[] }) {
  const sorted = useMemo(() => [...photos].sort((a, b) => a.taken_on.localeCompare(b.taken_on) || (a.created_at ?? '').localeCompare(b.created_at ?? '')), [photos])
  const [a, setA] = useState(sorted[0].id)
  const [b, setB] = useState(sorted[sorted.length - 1].id)
  const pa = sorted.find((p) => p.id === a) ?? sorted[0]
  const pb = sorted.find((p) => p.id === b) ?? sorted[sorted.length - 1]
  const days = Math.round((new Date(pb.taken_on).getTime() - new Date(pa.taken_on).getTime()) / 86400000)
  const pick = (value: string, set: (v: string) => void, label: string) => (
    <Select aria-label={label} value={value} onChange={(e) => set(e.target.value)} className="mt-2 text-xs">
      {sorted.map((p, i) => (
        <option key={p.id} value={p.id}>
          {fmtDate(p.taken_on, 'd MMM yyyy')} {sorted.filter((x) => x.taken_on === p.taken_on).length > 1 ? `(${i + 1})` : ''}
        </option>
      ))}
    </Select>
  )
  return (
    <Card className="mb-3 p-3">
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-semibold">Prima e dopo</span>
        {days > 0 && <span className="text-xs text-muted">{days} giorni di differenza</span>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[{ p: pa, v: a, set: setA, l: 'Prima' }, { p: pb, v: b, set: setB, l: 'Dopo' }].map(({ p, v, set, l }) => (
          <div key={l}>
            <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-surface">
              {p.url && <img src={p.url} alt={`${l}: ${fmtDate(p.taken_on)}`} className="size-full object-cover" />}
              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/70 px-2 py-0.5 text-[11px] font-semibold">{l}</span>
            </div>
            {pick(v, set, `Foto ${l.toLowerCase()}`)}
          </div>
        ))}
      </div>
    </Card>
  )
}

function RecordsBlock({ records }: { records: PersonalRecord[] }) {
  // un solo record per esercizio: il più alto (cioè il più recente)
  const best = [...new Map(records.map((r) => [r.exercise_key, r])).values()]
  return (
    <>
      <SectionTitle>
        <span className="flex items-center gap-2">
          Record personali <Trophy className="size-4 text-gold" />
        </span>
      </SectionTitle>
      <div className="card divide-y divide-line/50 p-0">
        {best.slice(0, 8).map((r) => (
          <div key={r.exercise_key} className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{r.exercise_name}</div>
              <div className="text-xs text-muted">
                {fmtDate(r.achieved_on, 'd MMM yyyy')}
                {r.previous_kg != null && ` · prima ${r.previous_kg} kg`}
              </div>
            </div>
            <div className="font-display text-xl tabular-nums">{r.weight_kg} kg</div>
          </div>
        ))}
      </div>
    </>
  )
}

/* ================= TRAGUARDI ================= */
export function BadgesGrid({ userId }: { userId?: string }) {
  const { profile } = useAuth()
  const uid = userId ?? profile?.id
  const { data: earned, loading } = useAsync(async () => {
    const { data } = await supabase.from('user_badges').select('*').eq('user_id', uid!)
    return new Map(((data as UserBadge[]) ?? []).map((b) => [b.code, b.earned_at]))
  }, [uid])
  if (loading || !earned) return <Loading rows={2} />
  const n = BADGES.filter((b) => earned.has(b.code)).length
  return (
    <div>
      {!userId && <p className="mb-3 text-sm text-muted">Si sbloccano da soli con gli ingressi, il diario e i record. Ne hai {n} su {BADGES.length}.</p>}
      {userId && <SectionTitle>Traguardi ({n}/{BADGES.length})</SectionTitle>}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {BADGES.map((b, i) => {
          const at = earned.get(b.code)
          return (
            <m.div key={b.code} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0, transition: { delay: Math.min(i, 8) * 0.03 } }} className={`rounded-2xl border p-3 ${at ? 'border-gold/50 bg-gold/10' : 'border-line/40 bg-surface/40 opacity-60'}`}>
              <Award className={`size-6 ${at ? 'text-gold' : 'text-muted'}`} aria-hidden />
              <div className="mt-2 text-sm font-semibold leading-tight">{b.title}</div>
              <div className="mt-0.5 text-xs text-muted">{b.desc}</div>
              <div className="mt-1.5 text-[11px] font-medium">{at ? <span className="text-gold">Sbloccato il {fmtDate(at, 'd MMM yyyy')}</span> : <span className="text-muted">Da sbloccare</span>}</div>
            </m.div>
          )
        })}
      </div>
    </div>
  )
}
