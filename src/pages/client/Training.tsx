import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, ClipboardList, Dumbbell, ImagePlus, Lock, Pause, Play, Plus, Target, Timer, Trash2 } from 'lucide-react'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Badge, Button, Card, Empty, Field, Input, Loading, PageHeader, SectionTitle, Segmented, Select, Sheet, Skeleton, Stat } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { fmtDate, isoDate } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { errMsg, signedUrl, supabase } from '../../lib/supabase'
import type { Goal, Measurement, WorkoutItem, WorkoutLog, WorkoutPlan } from '../../lib/types'

const Charts = lazy(() => import('../../components/Charts'))

type Tab = 'scheda' | 'progressi'

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
        ]}
        className="mb-5"
      />
      {tab === 'scheda' ? <PlanTab /> : <ProgressTab />}
    </div>
  )
}

/* ================= SCHEDA ================= */
function PlanTab() {
  const { profile } = useAuth()
  const { data: plans, loading } = useAsync(async () => {
    const { data } = await supabase.from('workout_plans').select('*, workout_plan_items(*)').eq('user_id', profile!.id).eq('is_active', true).order('created_at', { ascending: false })
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
    return <Empty icon={<ClipboardList className="size-7" />} title="Nessuna scheda" text="Il tuo trainer non ti ha ancora assegnato una scheda. Chiedila in sala o scrivigli dall'app!" />

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
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grain relative overflow-hidden rounded-3xl bg-navy-bright p-5">
        <div className="stripes absolute inset-0 opacity-30" />
        <div className="relative">
          <Badge tone="gold">{plan?.goal ?? 'Scheda personale'}</Badge>
          <h2 className="mt-2 font-display text-3xl uppercase leading-none">{plan?.title}</h2>
          {plan?.notes && <p className="mt-2 text-sm text-white/80">{plan.notes}</p>}
          <div className="mt-3 text-xs text-white/70">
            Dal {fmtDate(plan?.starts_on)} {plan?.ends_on ? `al ${fmtDate(plan.ends_on)}` : ''}
          </div>
        </div>
      </motion.div>

      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
        {days.map(([d]) => (
          <button key={d} onClick={() => setDay(d)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${d === day ? 'bg-gold text-ink' : 'bg-surface text-cream/80'}`}>
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
            <motion.button key={it.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }} whileTap={{ scale: 0.98 }} onClick={() => setLogItem(it)} className={`card flex w-full items-center gap-4 p-4 text-left ${done ? 'border-success/50' : ''}`}>
              <div className={`grid size-12 shrink-0 place-items-center rounded-2xl font-display text-xl ${done ? 'bg-success text-ink' : 'bg-gold/15 text-gold'}`}>{done ? <Check className="size-6" /> : i + 1}</div>
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
                  <div className="text-[10px] uppercase text-muted">kg ultimo</div>
                </div>
              )}
            </motion.button>
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
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!item) return
    const lastDay = logs.find((l) => l.plan_item_id === item.id)?.performed_on
    const prev = logs.filter((l) => l.plan_item_id === item.id && l.performed_on === lastDay)
    setSets(Array.from({ length: item.sets }, (_, i) => ({ weight: prev[i]?.weight_kg?.toString() ?? '', reps: prev[i]?.reps?.toString() ?? item.reps.replace(/\D.*/, '') })))
  }, [item, logs])
  const history = item ? logs.filter((l) => l.plan_item_id === item.id) : []
  const byDay = history.reduce<Record<string, WorkoutLog[]>>((acc, l) => ((acc[l.performed_on] ??= []).push(l), acc), {})

  async function save() {
    if (!item || !profile) return
    const rows = sets
      .map((s, i) => ({ user_id: profile.id, plan_item_id: item.id, exercise_name: item.exercise_name, performed_on: isoDate(), set_number: i + 1, weight_kg: s.weight ? Number(s.weight.replace(',', '.')) : null, reps: s.reps ? Number(s.reps) : null }))
      .filter((r) => r.weight_kg != null || r.reps != null)
    if (!rows.length) return toast.error('Inserisci almeno una serie')
    setBusy(true)
    await supabase.from('workout_logs').delete().eq('user_id', profile.id).eq('plan_item_id', item.id).eq('performed_on', isoDate())
    const { error } = await supabase.from('workout_logs').insert(rows)
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Serie salvate 🔥')
    onSaved()
    onClose()
  }

  return (
    <Sheet open={!!item} onClose={onClose} title={item?.exercise_name} footer={<Button block size="lg" loading={busy} onClick={save}>Salva allenamento</Button>}>
      {item && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone="gold">{item.sets} serie</Badge>
            <Badge tone="blue">{item.reps} ripetizioni</Badge>
            {item.load_note && <Badge>{item.load_note}</Badge>}
          </div>
          {item.rest_sec ? <RestTimer seconds={item.rest_sec} /> : null}
          <div className="space-y-2">
            {sets.map((s, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0, transition: { delay: i * 0.04 } }} className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-night font-display text-lg">{i + 1}</span>
                <Input inputMode="decimal" placeholder="kg" value={s.weight} onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} />
                <Input inputMode="numeric" placeholder="reps" value={s.reps} onChange={(e) => setSets(sets.map((x, j) => (j === i ? { ...x, reps: e.target.value } : x)))} />
              </motion.div>
            ))}
            <button type="button" onClick={() => setSets([...sets, { weight: '', reps: '' }])} className="flex items-center gap-1 text-sm font-semibold text-gold">
              <Plus className="size-4" /> Aggiungi serie
            </button>
          </div>
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
              <div className="text-[10px] uppercase tracking-wider text-muted">{f.label}</div>
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

      {isMe && !readOnly && <GoalsBlock />}
      {isMe && !readOnly && <PhotosBlock />}

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
    if (!g.is_done) toast.success('Obiettivo raggiunto! 🏆')
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
            <motion.div key={g.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} className="card flex items-center gap-3 p-3">
              <button onClick={() => toggle(g)} aria-label="Completa" className={`grid size-7 shrink-0 place-items-center rounded-full border-2 transition ${g.is_done ? 'border-success bg-success text-ink' : 'border-line'}`}>
                {g.is_done && <Check className="size-4" />}
              </button>
              <span className={`flex-1 text-sm ${g.is_done ? 'text-muted line-through' : ''}`}>{g.title}</span>
              <button onClick={() => remove(g)} aria-label="Elimina" className="text-muted hover:text-danger">
                <Trash2 className="size-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}

function PhotosBlock() {
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const { data: photos, reload } = useAsync(async () => {
    const { data } = await supabase.from('progress_photos').select('*').eq('user_id', profile!.id).order('taken_on', { ascending: false })
    const rows = (data as { id: string; file_path: string; taken_on: string }[]) ?? []
    return Promise.all(rows.map(async (r) => ({ ...r, url: await signedUrl('progress', r.file_path) })))
  }, [profile?.id])

  async function upload(file: File) {
    if (file.size > 10 * 1024 * 1024) return toast.error('Foto troppo grande (max 10 MB)')
    setBusy(true)
    const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
    const path = `${profile!.id}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('progress').upload(path, file, { contentType: file.type })
    if (up.error) {
      setBusy(false)
      return toast.error(errMsg(up.error))
    }
    await supabase.from('progress_photos').insert({ user_id: profile!.id, file_path: path })
    setBusy(false)
    toast.success('Foto salvata (visibile solo a te)')
    reload()
  }
  async function remove(id: string, path: string) {
    await supabase.storage.from('progress').remove([path])
    await supabase.from('progress_photos').delete().eq('id', id)
    reload()
  }
  return (
    <>
      <SectionTitle>
        <span className="flex items-center gap-2">
          Foto progressi <Lock className="size-4 text-muted" />
        </span>
      </SectionTitle>
      <div className="grid grid-cols-3 gap-2">
        <label className="grid aspect-[3/4] cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-line text-muted hover:border-gold hover:text-gold">
          {busy ? <Dumbbell className="size-6 animate-spin" /> : <ImagePlus className="size-7" />}
          <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
        </label>
        {(photos ?? []).map((p) => (
          <div key={p.id} className="group relative aspect-[3/4] overflow-hidden rounded-2xl bg-surface">
            {p.url && <img src={p.url} alt="" className="size-full object-cover" loading="lazy" />}
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 p-1.5 text-[10px]">{fmtDate(p.taken_on, 'd MMM yy')}</span>
            <button onClick={() => remove(p.id, p.file_path)} aria-label="Elimina foto" className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-black/60 text-white">
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
      <p className="mt-2 flex items-center gap-1 text-xs text-muted">
        <ChevronDown className="size-3" /> Le foto sono private: nemmeno lo staff può vederle.
      </p>
    </>
  )
}
