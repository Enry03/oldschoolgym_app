import { Reorder } from 'framer-motion'
import { Dumbbell, GripVertical, Plus, Search, Trash2, Video } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Badge, Button, Card, Empty, Field, Input, Loading, PageHeader, PhotoPlaceholder, Segmented, Select, Sheet, Textarea, Toggle } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { isoDate } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { errMsg, supabase } from '../../lib/supabase'
import type { Exercise, WorkoutItem, WorkoutPlan } from '../../lib/types'

const GROUPS = ['Petto', 'Dorso', 'Spalle', 'Braccia', 'Gambe', 'Glutei', 'Addome', 'Cardio', 'Full body']

export default function Workouts() {
  const [tab, setTab] = useState<'modelli' | 'esercizi'>('modelli')
  return (
    <div>
      <PageHeader title="Schede" kicker="Modelli ed esercizi" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'modelli', label: 'Modelli di scheda' },
          { value: 'esercizi', label: 'Libreria esercizi' },
        ]}
        className="mb-5"
      />
      {tab === 'modelli' ? <Templates /> : <ExerciseLibrary />}
    </div>
  )
}

function Templates() {
  const [editing, setEditing] = useState<WorkoutPlan | 'new' | null>(null)
  const { data, loading, reload } = useAsync(async () => {
    const { data } = await supabase.from('workout_plans').select('*, workout_plan_items(*)').eq('is_template', true).order('title')
    return (data as WorkoutPlan[]) ?? []
  })
  if (editing) return <PlanEditor plan={editing === 'new' ? null : editing} template onDone={() => { setEditing(null); reload() }} />
  return (
    <div>
      <Button block icon={<Plus className="size-4" />} onClick={() => setEditing('new')}>
        Nuovo modello
      </Button>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {loading ? (
          <Loading />
        ) : (data ?? []).length === 0 ? (
          <Empty title="Nessun modello" />
        ) : (
          (data ?? []).map((t) => (
            <button key={t.id} onClick={() => setEditing(t)} className="card p-4 text-left transition hover:border-gold/40">
              <Badge tone="gold">{t.goal ?? 'Generale'}</Badge>
              <div className="mt-2 font-display text-2xl uppercase leading-tight">{t.title}</div>
              <div className="mt-1 text-xs text-muted">
                {t.workout_plan_items?.length ?? 0} esercizi · {new Set(t.workout_plan_items?.map((i) => i.day_label)).size} giorni
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

type Draft = Omit<WorkoutItem, 'id' | 'plan_id'> & { key: string; id?: string }

export function PlanEditor({ plan, userId, template, onDone }: { plan: WorkoutPlan | null; userId?: string; template?: boolean; onDone: () => void }) {
  const { profile } = useAuth()
  const [title, setTitle] = useState(plan?.title ?? (template ? 'Nuovo modello' : 'Scheda personalizzata'))
  const [goal, setGoal] = useState(plan?.goal ?? 'Ipertrofia')
  const [notes, setNotes] = useState(plan?.notes ?? '')
  const [ends, setEnds] = useState(plan?.ends_on ?? '')
  const [active, setActive] = useState(plan?.is_active ?? true)
  const [items, setItems] = useState<Draft[]>(() =>
    [...(plan?.workout_plan_items ?? [])].sort((a, b) => a.sort - b.sort).map((i) => ({ ...i, key: i.id })),
  )
  const [day, setDay] = useState(items[0]?.day_label ?? 'Giorno A')
  const [pick, setPick] = useState(false)
  const [busy, setBusy] = useState(false)
  const days = useMemo(() => {
    const s = [...new Set(items.map((i) => i.day_label))]
    return s.includes(day) ? s : [...s, day]
  }, [items, day])
  const dayItems = items.filter((i) => i.day_label === day)

  function addExercise(e: Exercise) {
    setItems([...items, { key: crypto.randomUUID(), day_label: day, exercise_id: e.id, exercise_name: e.name, sets: 3, reps: '10', rest_sec: 90, load_note: null, notes: null, sort: items.length }])
    setPick(false)
  }
  function update(key: string, patch: Partial<Draft>) {
    setItems(items.map((i) => (i.key === key ? { ...i, ...patch } : i)))
  }
  function reorderDay(newDay: Draft[]) {
    const others = items.filter((i) => i.day_label !== day)
    setItems([...others, ...newDay])
  }

  async function save() {
    setBusy(true)
    let planId = plan?.id
    const base = { title, goal, notes: notes || null, ends_on: ends || null, is_active: active }
    if (!planId) {
      const { data, error } = await supabase.from('workout_plans').insert({ ...base, user_id: template ? null : userId, is_template: !!template, created_by: profile!.id, starts_on: isoDate() }).select().single()
      if (error) {
        setBusy(false)
        return toast.error(errMsg(error))
      }
      planId = data.id
    } else {
      const { error } = await supabase.from('workout_plans').update(base).eq('id', planId)
      if (error) {
        setBusy(false)
        return toast.error(errMsg(error))
      }
      await supabase.from('workout_plan_items').delete().eq('plan_id', planId)
    }
    const rows = items.map((i, idx) => ({ plan_id: planId, day_label: i.day_label, exercise_id: i.exercise_id, exercise_name: i.exercise_name, sets: i.sets, reps: i.reps, rest_sec: i.rest_sec, load_note: i.load_note, notes: i.notes, sort: idx }))
    if (rows.length) {
      const { error } = await supabase.from('workout_plan_items').insert(rows)
      if (error) {
        setBusy(false)
        return toast.error(errMsg(error))
      }
    }
    setBusy(false)
    toast.success('Scheda salvata 💪')
    onDone()
  }
  async function remove() {
    if (!plan || !confirm('Eliminare questa scheda?')) return
    await supabase.from('workout_plans').delete().eq('id', plan.id)
    onDone()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <button onClick={onDone} className="text-sm text-gold">
          ← Indietro
        </button>
        {plan && (
          <Button size="sm" variant="danger" icon={<Trash2 className="size-4" />} onClick={remove}>
            Elimina
          </Button>
        )}
      </div>
      <Card className="space-y-3">
        <Field label="Titolo">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Obiettivo">
            <Select value={goal} onChange={(e) => setGoal(e.target.value)}>
              {['Ipertrofia', 'Forza', 'Dimagrimento', 'Tonificazione', 'Resistenza', 'Riatletizzazione', 'Boxe'].map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Select>
          </Field>
          {!template && (
            <Field label="Valida fino al">
              <Input type="date" value={ends} onChange={(e) => setEnds(e.target.value)} />
            </Field>
          )}
        </div>
        <Field label="Note per il cliente">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Riscaldamento 10' bike, stretching finale…" />
        </Field>
        {!template && <Toggle label="Scheda attiva" checked={active} onChange={setActive} />}
      </Card>

      <div className="no-scrollbar mt-5 flex items-center gap-2 overflow-x-auto pb-1">
        {days.map((d) => (
          <button key={d} onClick={() => setDay(d)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold ${d === day ? 'bg-gold text-ink' : 'bg-surface text-cream/80'}`}>
            {d}
          </button>
        ))}
        <button onClick={() => setDay(`Giorno ${String.fromCharCode(65 + days.length)}`)} className="shrink-0 rounded-full border border-dashed border-line px-4 py-2 text-sm text-muted">
          + Giorno
        </button>
      </div>

      <Reorder.Group axis="y" values={dayItems} onReorder={reorderDay} className="mt-3 space-y-2">
        {dayItems.map((it) => (
          <Reorder.Item key={it.key} value={it} className="card p-3">
            <div className="flex items-center gap-2">
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted" />
              <div className="flex-1 font-semibold">{it.exercise_name}</div>
              <button aria-label="Rimuovi" onClick={() => setItems(items.filter((x) => x.key !== it.key))} className="text-muted hover:text-danger">
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              <Input aria-label="Serie" inputMode="numeric" value={it.sets} onChange={(e) => update(it.key, { sets: Number(e.target.value) || 0 })} className="!px-2 text-center" />
              <Input aria-label="Ripetizioni" value={it.reps} onChange={(e) => update(it.key, { reps: e.target.value })} className="!px-2 text-center" />
              <Input aria-label="Recupero secondi" inputMode="numeric" value={it.rest_sec ?? ''} onChange={(e) => update(it.key, { rest_sec: Number(e.target.value) || null })} className="!px-2 text-center" />
              <Input aria-label="Carico" value={it.load_note ?? ''} placeholder="kg" onChange={(e) => update(it.key, { load_note: e.target.value || null })} className="!px-2 text-center" />
            </div>
            <div className="mt-1 grid grid-cols-4 gap-2 text-center text-[10px] uppercase text-muted">
              <span>serie</span>
              <span>reps</span>
              <span>rec. sec</span>
              <span>carico</span>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <Button variant="outline" block className="mt-3" icon={<Plus className="size-4" />} onClick={() => setPick(true)}>
        Aggiungi esercizio a {day}
      </Button>
      <Button block size="lg" className="mt-6" loading={busy} onClick={save}>
        Salva scheda
      </Button>
      <ExercisePicker open={pick} onClose={() => setPick(false)} onPick={addExercise} />
    </div>
  )
}

function ExercisePicker({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void }) {
  const [q, setQ] = useState('')
  const [g, setG] = useState('')
  const { data } = useAsync(async () => {
    const { data } = await supabase.from('exercises').select('*').order('name')
    return (data as Exercise[]) ?? []
  })
  const list = (data ?? []).filter((e) => (!g || e.muscle_group === g) && e.name.toLowerCase().includes(q.toLowerCase()))
  return (
    <Sheet open={open} onClose={onClose} title="Esercizi">
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input className="pl-10" placeholder="Cerca" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="no-scrollbar mb-3 flex gap-2 overflow-x-auto">
        {['', ...GROUPS].map((x) => (
          <button key={x} onClick={() => setG(x)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-bold ${g === x ? 'bg-gold text-ink' : 'bg-surface text-muted'}`}>
            {x || 'Tutti'}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {list.map((e) => (
          <button key={e.id} onClick={() => onPick(e)} className="flex w-full items-center gap-3 rounded-xl bg-surface/60 p-3 text-left hover:bg-surface">
            <Dumbbell className="size-4 text-gold" />
            <span className="flex-1 text-sm font-medium">{e.name}</span>
            <span className="text-xs text-muted">{e.muscle_group}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

function ExerciseLibrary() {
  const [q, setQ] = useState('')
  const [edit, setEdit] = useState<Partial<Exercise> | null>(null)
  const { data, loading, reload } = useAsync(async () => {
    const { data } = await supabase.from('exercises').select('*').order('muscle_group').order('name')
    return (data as Exercise[]) ?? []
  })
  const list = (data ?? []).filter((e) => `${e.name} ${e.muscle_group}`.toLowerCase().includes(q.toLowerCase()))
  return (
    <div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input className="pl-10" placeholder="Cerca esercizio" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Button aria-label="Nuovo esercizio" onClick={() => setEdit({ muscle_group: 'Petto' })}>
          <Plus className="size-5" />
        </Button>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {loading ? (
          <Loading />
        ) : (
          list.map((e) => (
            <button key={e.id} onClick={() => setEdit(e)} className="card overflow-hidden p-0 text-left">
              <div className="relative">
                <PhotoPlaceholder label={e.muscle_group} className="aspect-video" tone="dark" />
                {e.video_url && <Video className="absolute right-2 top-2 size-4 text-gold" />}
              </div>
              <div className="p-3">
                <div className="line-clamp-1 text-sm font-semibold">{e.name}</div>
                <div className="text-[11px] text-muted">{e.equipment ?? e.muscle_group}</div>
              </div>
            </button>
          ))
        )}
      </div>
      <ExerciseSheet ex={edit} onClose={() => setEdit(null)} onSaved={reload} />
    </div>
  )
}

function ExerciseSheet({ ex, onClose, onSaved }: { ex: Partial<Exercise> | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState<Partial<Exercise>>({})
  useEffect(() => setF(ex ?? {}), [ex])
  async function save() {
    if (!f.name) return toast.error('Inserisci il nome')
    const row = { name: f.name, muscle_group: f.muscle_group ?? 'Full body', equipment: f.equipment || null, description: f.description || null, video_url: f.video_url || null }
    const { error } = f.id ? await supabase.from('exercises').update(row).eq('id', f.id) : await supabase.from('exercises').insert(row)
    if (error) return toast.error(errMsg(error))
    toast.success('Esercizio salvato')
    onSaved()
    onClose()
  }
  return (
    <Sheet open={!!ex} onClose={onClose} title={f.id ? 'Modifica esercizio' : 'Nuovo esercizio'} footer={<Button block size="lg" onClick={save}>Salva</Button>}>
      <div className="space-y-3">
        <Field label="Nome">
          <Input value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Gruppo">
            <Select value={f.muscle_group ?? ''} onChange={(e) => setF({ ...f, muscle_group: e.target.value })}>
              {GROUPS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </Select>
          </Field>
          <Field label="Attrezzo">
            <Input value={f.equipment ?? ''} onChange={(e) => setF({ ...f, equipment: e.target.value })} />
          </Field>
        </div>
        <Field label="Link video (YouTube, ecc.)">
          <Input type="url" value={f.video_url ?? ''} onChange={(e) => setF({ ...f, video_url: e.target.value })} />
        </Field>
        <Field label="Esecuzione">
          <Textarea value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
      </div>
    </Sheet>
  )
}
