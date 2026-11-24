import { Reorder } from 'motion/react'
import { Check, FileDown, GripVertical, ImagePlus, Plus, Search, Trash2, UserPlus, Video, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ExerciseThumb, exerciseImg, removeExercisePhotos, safeLink, uploadExercisePhoto } from '../../components/ExerciseMedia'
import { Avatar, Badge, Button, Card, Chips, Empty, Field, Input, Loading, PageHeader, PhotoPlaceholder, SectionTitle, Segmented, Select, Sheet, Textarea, Toggle } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { fullName, isoDate } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { errMsg, supabase } from '../../lib/supabase'
import type { Exercise, WorkoutItem, WorkoutPlan } from '../../lib/types'

const GROUPS = ['Petto', 'Dorso', 'Spalle', 'Braccia', 'Gambe', 'Glutei', 'Addome', 'Cardio', 'Full body']
const CATEGORIES = ['Funzionale', 'Ipertrofia', 'Forza', 'Dimagrimento', 'Tonificazione', 'Resistenza', 'Riatletizzazione', 'Boxe']
const NO_CAT = 'Senza categoria'

type ClientLite = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }
type ClientPlan = WorkoutPlan & { client: ClientLite | null }

export default function Workouts() {
  const [tab, setTab] = useState<'schede' | 'esercizi'>('schede')
  return (
    <div>
      <PageHeader title="Schede" kicker="Schede ed esercizi" />
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'schede', label: 'Schede' },
          { value: 'esercizi', label: 'Libreria esercizi' },
        ]}
        className="mb-5"
      />
      {tab === 'schede' ? <Plans /> : <ExerciseLibrary />}
    </div>
  )
}

/* ================= SCHEDE: per categoria o per cliente ================= */
function Plans() {
  const [view, setView] = useState<'categorie' | 'clienti'>('categorie')
  const [editing, setEditing] = useState<{ plan: WorkoutPlan | null; userId?: string } | null>(null)
  const [cat, setCat] = useState('')
  const [q, setQ] = useState('')
  const templates = useAsync(async () => {
    const { data } = await supabase.from('workout_plans').select('*, workout_plan_items(*)').eq('is_template', true).order('title')
    return (data as WorkoutPlan[]) ?? []
  })
  const assigned = useAsync(async () => {
    const { data } = await supabase
      .from('workout_plans')
      .select('*, workout_plan_items(*), client:profiles!workout_plans_user_id_fkey(id, first_name, last_name, avatar_url)')
      .eq('is_template', false)
      .not('user_id', 'is', null)
      .order('created_at', { ascending: false })
    return (data as ClientPlan[]) ?? []
  })

  if (editing)
    return (
      <PlanEditor
        plan={editing.plan}
        userId={editing.userId}
        template={!editing.userId}
        onDone={() => {
          setEditing(null)
          templates.reload()
          assigned.reload()
        }}
      />
    )

  const cats = [...new Set((templates.data ?? []).map((t) => t.goal || NO_CAT))].sort((a, b) => a.localeCompare(b))
  const byCat = (templates.data ?? []).filter((t) => !cat || (t.goal || NO_CAT) === cat)
  const groupsCat = cats.filter((c) => !cat || c === cat).map((c) => [c, byCat.filter((t) => (t.goal || NO_CAT) === c)] as const)

  const needle = q.trim().toLowerCase()
  const byClient = new Map<string, ClientPlan[]>()
  for (const p of assigned.data ?? []) {
    const name = fullName(p.client) || 'Cliente'
    if (needle && !`${name} ${p.title} ${p.goal ?? ''}`.toLowerCase().includes(needle)) continue
    byClient.set(p.user_id!, [...(byClient.get(p.user_id!) ?? []), p])
  }
  const groupsClient = [...byClient.values()].sort((a, b) => fullName(a[0].client).localeCompare(fullName(b[0].client)))

  return (
    <div>
      <Button block icon={<Plus className="size-4" />} onClick={() => setEditing({ plan: null })}>
        Nuova scheda
      </Button>
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'categorie', label: 'Per categoria' },
          { value: 'clienti', label: 'Per cliente' },
        ]}
        className="mt-4"
      />

      {view === 'categorie' ? (
        <div className="mt-4">
          {cats.length > 1 && <Chips value={cat} onChange={setCat} options={[{ value: '', label: 'Tutte' }, ...cats.map((c) => ({ value: c, label: c }))]} />}
          {templates.loading ? (
            <Loading />
          ) : !groupsCat.length ? (
            <Empty title="Nessuna scheda modello" text="Crea una scheda e dalle una categoria (per esempio Funzionale): la ritrovi qui, pronta da assegnare." />
          ) : (
            groupsCat.map(([c, list]) => (
              <section key={c} className="mt-5">
                <SectionTitle>
                  {c} <span className="font-normal text-muted">· {list.length}</span>
                </SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2">
                  {list.map((t) => (
                    <button key={t.id} onClick={() => setEditing({ plan: t })} className="card p-4 text-left transition hover:border-gold/40">
                      <div className="text-lg font-semibold leading-tight">{t.title}</div>
                      <div className="mt-1 text-xs text-muted">
                        {t.workout_plan_items?.length ?? 0} esercizi · {daysCount(t)} {daysCount(t) === 1 ? 'giorno' : 'giorni'}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      ) : (
        <div className="mt-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input className="pl-10" placeholder="Cerca cliente o scheda" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {assigned.loading ? (
            <Loading />
          ) : !groupsClient.length ? (
            <Empty title="Nessuna scheda assegnata" text="Quando assegni una scheda a un cliente la trovi qui, e il cliente la vede nella sua app." />
          ) : (
            groupsClient.map((list) => (
              <section key={list[0].user_id} className="mt-5">
                <div className="mb-2 flex items-center gap-2">
                  <Avatar p={list[0].client} size={28} />
                  <Link to={`/staff/clienti/${list[0].user_id}`} className="font-semibold hover:text-gold">
                    {fullName(list[0].client) || 'Cliente'}
                  </Link>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {list.map((p) => (
                    <button key={p.id} onClick={() => setEditing({ plan: p, userId: p.user_id! })} className="card flex items-center gap-3 p-4 text-left transition hover:border-gold/40">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold">{p.title}</div>
                        <div className="text-xs text-muted">
                          {p.goal || NO_CAT} · {p.workout_plan_items?.length ?? 0} esercizi
                        </div>
                      </div>
                      <Badge tone={p.is_active ? 'green' : 'gray'}>{p.is_active ? 'Attiva' : 'Archiviata'}</Badge>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </div>
  )
}

const daysCount = (p: WorkoutPlan) => new Set(p.workout_plan_items?.map((i) => i.day_label)).size

/* ================= Assegnazione: ogni cliente riceve una sua copia ================= */
type ItemRow = Omit<WorkoutItem, 'id' | 'plan_id' | 'exercises'>

/** Crea una copia della scheda per ogni cliente (che riceve la notifica). Restituisce quante non sono riuscite. */
export async function assignPlan(base: { title: string; goal: string | null; notes: string | null; ends_on?: string | null }, items: ItemRow[], clientIds: string[], createdBy: string) {
  let failed = 0
  for (const uid of clientIds) {
    const { data: p, error } = await supabase
      .from('workout_plans')
      .insert({ ...base, user_id: uid, is_template: false, is_active: true, created_by: createdBy, starts_on: isoDate() })
      .select('id')
      .single()
    if (error) {
      failed++
      continue
    }
    if (items.length) {
      const { error: e2 } = await supabase.from('workout_plan_items').insert(items.map((i, idx) => ({ ...i, plan_id: p.id, sort: idx })))
      if (e2) {
        await supabase.from('workout_plans').delete().eq('id', p.id)
        failed++
      }
    }
  }
  return failed
}

function ClientPicker({ open, onClose, selected, onChange }: { open: boolean; onClose: () => void; selected: string[]; onChange: (ids: string[]) => void }) {
  const [q, setQ] = useState('')
  const { data } = useAsync(async () => {
    const { data } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').eq('role', 'client').eq('approval_status', 'approved').eq('is_active', true).order('first_name')
    return (data as ClientLite[]) ?? []
  })
  const list = (data ?? []).filter((c) => fullName(c).toLowerCase().includes(q.trim().toLowerCase()))
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  return (
    <Sheet open={open} onClose={onClose} title="Assegna ai clienti" footer={<Button block size="lg" onClick={onClose}>Fatto · {selected.length} {selected.length === 1 ? 'cliente' : 'clienti'}</Button>}>
      <div className="relative mb-3">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input className="pl-10" placeholder="Cerca cliente" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        {list.length === 0 && <p className="text-sm text-muted">Nessun cliente trovato.</p>}
        {list.map((c) => {
          const on = selected.includes(c.id)
          return (
            <button key={c.id} type="button" aria-pressed={on} onClick={() => toggle(c.id)} className={`flex w-full items-center gap-3 rounded-xl p-2.5 text-left ${on ? 'bg-gold/15' : 'bg-surface/60 hover:bg-surface'}`}>
              <Avatar p={c} size={36} />
              <span className="flex-1 text-sm font-medium">{fullName(c)}</span>
              <span className={`grid size-6 place-items-center rounded-md border ${on ? 'border-gold bg-gold text-ink' : 'border-line'}`}>{on && <Check className="size-4" />}</span>
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

/* ================= Editor scheda ================= */
type Draft = Omit<WorkoutItem, 'id' | 'plan_id'> & { key: string; id?: string }

export function PlanEditor({ plan, userId, template, onDone }: { plan: WorkoutPlan | null; userId?: string; template?: boolean; onDone: () => void }) {
  const { profile } = useAuth()
  const [title, setTitle] = useState(plan?.title ?? (template ? '' : 'Scheda personalizzata'))
  const [goal, setGoal] = useState(plan?.goal ?? '')
  const [notes, setNotes] = useState(plan?.notes ?? '')
  const [ends, setEnds] = useState(plan?.ends_on ?? '')
  const [active, setActive] = useState(plan?.is_active ?? true)
  const [asModel, setAsModel] = useState(true)
  const [targets, setTargets] = useState<string[]>([])
  const [pickClients, setPickClients] = useState(false)
  const [items, setItems] = useState<Draft[]>(() =>
    [...(plan?.workout_plan_items ?? [])].sort((a, b) => a.sort - b.sort).map((i) => ({ ...i, key: i.id })),
  )
  const [day, setDay] = useState(items[0]?.day_label ?? 'Giorno A')
  const [pick, setPick] = useState(false)
  const [busy, setBusy] = useState(false)
  const { data: exercises } = useAsync(async () => {
    const { data } = await supabase.from('exercises').select('*').order('name')
    return (data as Exercise[]) ?? []
  })
  const exById = useMemo(() => new Map((exercises ?? []).map((e) => [e.id, e])), [exercises])
  const { data: catsUsed } = useAsync(async () => {
    const { data } = await supabase.from('workout_plans').select('goal').eq('is_template', true)
    return [...new Set([...CATEGORIES, ...((data ?? []) as { goal: string | null }[]).map((r) => r.goal).filter((g): g is string => !!g)])]
  })
  const days = useMemo(() => {
    const s = [...new Set(items.map((i) => i.day_label))]
    return s.includes(day) ? s : [...s, day]
  }, [items, day])
  const dayItems = items.filter((i) => i.day_label === day)
  const isNewModel = template && !plan

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
  const rowOf = (i: Draft, idx: number): ItemRow => ({ day_label: i.day_label, exercise_id: i.exercise_id, exercise_name: i.exercise_name, sets: i.sets, reps: i.reps, rest_sec: i.rest_sec, load_note: i.load_note, notes: i.notes, sort: idx })

  /** Salva la scheda aggiornando le righe esistenti (così lo storico dei pesi del cliente resta collegato). */
  async function savePlan(): Promise<string | null> {
    const base = { title: title.trim(), goal: goal.trim() || null, notes: notes || null, ends_on: template ? null : ends || null, is_active: active }
    let planId = plan?.id
    if (!planId) {
      const { data, error } = await supabase.from('workout_plans').insert({ ...base, user_id: template ? null : userId, is_template: !!template, created_by: profile!.id, starts_on: isoDate() }).select('id').single()
      if (error) throw error
      planId = data.id as string
    } else {
      const { error } = await supabase.from('workout_plans').update(base).eq('id', planId)
      if (error) throw error
    }
    const keep = items.filter((i) => i.id).map((i) => i.id!)
    const removed = (plan?.workout_plan_items ?? []).map((i) => i.id).filter((id) => !keep.includes(id))
    if (removed.length) {
      const { error } = await supabase.from('workout_plan_items').delete().in('id', removed)
      if (error) throw error
    }
    const existing = items.map((i, idx) => ({ i, idx })).filter(({ i }) => i.id)
    for (const { i, idx } of existing) {
      const { error } = await supabase.from('workout_plan_items').update(rowOf(i, idx)).eq('id', i.id!)
      if (error) throw error
    }
    const fresh = items.map((i, idx) => ({ i, idx })).filter(({ i }) => !i.id).map(({ i, idx }) => ({ ...rowOf(i, idx), plan_id: planId }))
    if (fresh.length) {
      const { error } = await supabase.from('workout_plan_items').insert(fresh)
      if (error) throw error
    }
    return planId
  }

  async function save() {
    if (!title.trim()) return toast.error('Dai un titolo alla scheda')
    if (isNewModel && !asModel && !targets.length) return toast.error('Scegli almeno un cliente, oppure salvala tra le schede della categoria')
    setBusy(true)
    try {
      if (!isNewModel || asModel) await savePlan()
      if (targets.length) {
        const failed = await assignPlan({ title: title.trim(), goal: goal.trim() || null, notes: notes || null }, items.map(rowOf), targets, profile!.id)
        if (failed) toast.error(`${failed} ${failed === 1 ? 'assegnazione non riuscita' : 'assegnazioni non riuscite'}: puoi assegnare solo ai clienti che segui`)
        if (failed < targets.length) toast.success(`Scheda inviata a ${targets.length - failed} ${targets.length - failed === 1 ? 'cliente' : 'clienti'}: la vedono nella loro app`)
      } else toast.success('Scheda salvata')
      onDone()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!plan || !confirm('Eliminare questa scheda?')) return
    const { error } = await supabase.from('workout_plans').delete().eq('id', plan.id)
    if (error) return toast.error(errMsg(error))
    onDone()
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-2">
        <button onClick={onDone} className="text-sm text-gold">
          ← Indietro
        </button>
        <div className="flex gap-2">
          {plan && (
            <Link to={`/stampa/scheda/${plan.id}`} className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/5 px-3 text-sm font-semibold text-cream hover:bg-white/10">
              <FileDown className="size-4" /> PDF
            </Link>
          )}
          {plan && (
            <Button size="sm" variant="danger" icon={<Trash2 className="size-4" />} onClick={remove}>
              Elimina
            </Button>
          )}
        </div>
      </div>
      <Card className="space-y-3">
        <Field label="Titolo">
          <Input value={title} placeholder="Es. Funzionale base 3 giorni" onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoria" hint="Scegline una o scrivine una nuova">
            <Input list="plan-categories" value={goal} placeholder="Es. Funzionale" onChange={(e) => setGoal(e.target.value)} />
            <datalist id="plan-categories">
              {(catsUsed ?? CATEGORIES).map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
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
        {!template && <Toggle label="Scheda attiva" desc="Le schede archiviate non compaiono più al cliente" checked={active} onChange={setActive} />}
      </Card>

      {template && (
        <Card className="mt-3 space-y-3">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-semibold">Assegna ai clienti</div>
              <div className="text-xs text-muted">Ognuno riceve una sua copia, che poi puoi personalizzare. La vede subito nella sua app.</div>
            </div>
            <Button size="sm" variant="outline" icon={<UserPlus className="size-4" />} onClick={() => setPickClients(true)}>
              Scegli
            </Button>
          </div>
          {targets.length > 0 && <SelectedClients ids={targets} onRemove={(id) => setTargets(targets.filter((x) => x !== id))} />}
          {isNewModel && <Toggle label="Salva anche tra le schede della categoria" desc="Così la ritrovi in Schede › Per categoria e la riusi quando vuoi" checked={asModel} onChange={setAsModel} />}
        </Card>
      )}

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
              <ExerciseThumb media={it.exercise_id ? exById.get(it.exercise_id) : null} className="size-10" />
              <div className="min-w-0 flex-1 font-semibold">{it.exercise_name}</div>
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
            <div className="mt-1 grid grid-cols-4 gap-2 text-center text-[11px] text-muted">
              <span>serie</span>
              <span>reps</span>
              <span>rec. sec</span>
              <span>carico</span>
            </div>
            <Input aria-label="Nota sull'esercizio" value={it.notes ?? ''} placeholder="Nota (es. fermo 2'' in basso)" onChange={(e) => update(it.key, { notes: e.target.value || null })} className="mt-2 !py-2 text-sm" />
          </Reorder.Item>
        ))}
      </Reorder.Group>
      <Button variant="outline" block className="mt-3" icon={<Plus className="size-4" />} onClick={() => setPick(true)}>
        Aggiungi esercizio a {day}
      </Button>
      <Button block size="lg" className="mt-6" loading={busy} onClick={save}>
        {targets.length ? `Salva e invia a ${targets.length} ${targets.length === 1 ? 'cliente' : 'clienti'}` : 'Salva scheda'}
      </Button>
      <ExercisePicker open={pick} onClose={() => setPick(false)} onPick={addExercise} exercises={exercises ?? []} />
      {template && <ClientPicker open={pickClients} onClose={() => setPickClients(false)} selected={targets} onChange={setTargets} />}
    </div>
  )
}

function SelectedClients({ ids, onRemove }: { ids: string[]; onRemove: (id: string) => void }) {
  const { data } = useAsync(async () => {
    const { data } = await supabase.from('profiles').select('id, first_name, last_name, avatar_url').in('id', ids)
    return (data as ClientLite[]) ?? []
  }, [ids.join(',')])
  return (
    <div className="flex flex-wrap gap-2">
      {(data ?? []).map((c) => (
        <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full bg-gold/15 py-1 pl-1 pr-2 text-sm text-gold">
          <Avatar p={c} size={22} />
          {fullName(c)}
          <button type="button" aria-label={`Togli ${fullName(c)}`} onClick={() => onRemove(c.id)} className="hover:text-cream">
            <X className="size-3.5" />
          </button>
        </span>
      ))}
    </div>
  )
}

function ExercisePicker({ open, onClose, onPick, exercises }: { open: boolean; onClose: () => void; onPick: (e: Exercise) => void; exercises: Exercise[] }) {
  const [q, setQ] = useState('')
  const [g, setG] = useState('')
  const list = exercises.filter((e) => (!g || e.muscle_group === g) && e.name.toLowerCase().includes(q.toLowerCase()))
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
          <button key={e.id} onClick={() => onPick(e)} className="flex w-full items-center gap-3 rounded-xl bg-surface/60 p-2.5 text-left hover:bg-surface">
            <ExerciseThumb media={e} className="size-10" />
            <span className="flex-1 text-sm font-medium">{e.name}</span>
            {e.video_url && <Video className="size-4 text-gold" aria-label="Ha un video" />}
            <span className="text-xs text-muted">{e.muscle_group}</span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/* ================= Libreria esercizi ================= */
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
        <Button aria-label="Nuovo esercizio" onClick={() => setEdit({ muscle_group: 'Petto', images: [] })}>
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
                {e.images?.[0] ? (
                  <img src={exerciseImg(e.images[0]) ?? ''} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                ) : (
                  <PhotoPlaceholder label="Aggiungi foto" className="aspect-video" tone="dark" />
                )}
                {e.video_url && <Video className="absolute right-2 top-2 size-4 text-gold drop-shadow" aria-label="Ha un video" />}
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
  const [uploading, setUploading] = useState(false)
  const [busy, setBusy] = useState(false)
  const uploaded = useRef<string[]>([]) // foto caricate ora: se si chiude senza salvare si cancellano
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    setF(ex ?? {})
    uploaded.current = []
  }, [ex])
  const images = f.images ?? []

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return
    const room = 4 - images.length
    if (room <= 0) return toast.error('Massimo 4 foto per esercizio')
    setUploading(true)
    const added: string[] = []
    for (const file of [...files].slice(0, room)) {
      try {
        const path = await uploadExercisePhoto(file)
        added.push(path)
        uploaded.current.push(path)
      } catch (e) {
        toast.error(errMsg(e))
      }
    }
    setF((cur) => ({ ...cur, images: [...(cur.images ?? []), ...added] }))
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function close() {
    void removeExercisePhotos(uploaded.current)
    uploaded.current = []
    onClose()
  }

  async function save() {
    if (!f.name?.trim()) return toast.error('Inserisci il nome')
    const video = f.video_url?.trim() || null
    if (video && !safeLink(video)) return toast.error('Il link video deve iniziare con https://')
    setBusy(true)
    const row = { name: f.name.trim(), muscle_group: f.muscle_group ?? 'Full body', equipment: f.equipment || null, description: f.description || null, video_url: video, images, image_url: images[0] ?? null }
    const { error } = f.id ? await supabase.from('exercises').update(row).eq('id', f.id) : await supabase.from('exercises').insert(row)
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    // le foto tolte dall'esercizio si cancellano solo dopo il salvataggio
    await removeExercisePhotos((ex?.images ?? []).filter((p) => !images.includes(p)))
    uploaded.current = []
    toast.success('Esercizio salvato: le foto compaiono in tutte le schede')
    onSaved()
    onClose()
  }

  return (
    <Sheet open={!!ex} onClose={close} title={f.id ? 'Modifica esercizio' : 'Nuovo esercizio'} footer={<Button block size="lg" loading={busy} disabled={uploading} onClick={save}>Salva</Button>}>
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
        <Field label="Foto" hint="Fino a 4 (es. posizione iniziale e finale). Le carichi una volta e valgono per tutte le schede.">
          <div className="grid grid-cols-4 gap-2">
            {images.map((p, i) => (
              <div key={p} className="relative">
                <img src={exerciseImg(p) ?? ''} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-xl object-cover" />
                <button type="button" aria-label={`Togli foto ${i + 1}`} onClick={() => setF({ ...f, images: images.filter((x) => x !== p) })} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-ink/80 text-cream hover:text-danger">
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
            {images.length < 4 && (
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="grid aspect-square place-items-center rounded-xl border border-dashed border-line text-muted hover:border-gold/60 hover:text-gold disabled:opacity-50">
                <span className="flex flex-col items-center gap-1 text-[11px]">
                  <ImagePlus className="size-5" />
                  {uploading ? 'Carico…' : 'Allega foto'}
                </span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
        </Field>
        <Field label="Link video (YouTube, Instagram…)">
          <Input type="url" inputMode="url" placeholder="https://" value={f.video_url ?? ''} onChange={(e) => setF({ ...f, video_url: e.target.value })} />
        </Field>
        <Field label="Esecuzione">
          <Textarea value={f.description ?? ''} placeholder="Come si esegue, errori da evitare…" onChange={(e) => setF({ ...f, description: e.target.value })} />
        </Field>
      </div>
    </Sheet>
  )
}
