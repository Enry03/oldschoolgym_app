import { ArrowLeft, Printer } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { exerciseImg, safeLink } from '../components/ExerciseMedia'
import { Empty, Logo, Spinner } from '../components/ui'
import { useAuth } from '../context/AuthContext'
import { fmtDate, fullName } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import type { WorkoutItem, WorkoutPlan } from '../lib/types'

type PrintablePlan = WorkoutPlan & { client: { first_name: string | null; last_name: string | null } | null }

/**
 * Scheda impaginata su foglio A4: si stampa o si salva in PDF dal browser ("Salva come PDF").
 * L'accesso lo decidono le regole del database: lo staff vede le sue schede, il cliente solo le proprie.
 */
export default function PrintPlan() {
  const { id } = useParams()
  const nav = useNavigate()
  const { settings } = useAuth()
  const { data: plan, loading } = useAsync(async () => {
    const { data } = await supabase
      .from('workout_plans')
      .select('*, workout_plan_items(*, exercises(images, video_url, description, equipment)), client:profiles!workout_plans_user_id_fkey(first_name, last_name)')
      .eq('id', id!)
      .maybeSingle()
    return data as PrintablePlan | null
  }, [id])
  const days = useMemo(() => {
    const map = new Map<string, WorkoutItem[]>()
    ;[...(plan?.workout_plan_items ?? [])].sort((a, b) => a.sort - b.sort).forEach((it) => map.set(it.day_label, [...(map.get(it.day_label) ?? []), it]))
    return [...map.entries()]
  }, [plan])

  if (loading) return <Spinner />
  if (!plan)
    return (
      <div className="p-6">
        <Empty title="Scheda non trovata" text="Non esiste più oppure non hai il permesso di vederla." />
      </div>
    )

  const contacts = [settings?.address, settings?.phone, settings?.instagram && `@${settings.instagram.replace(/^@/, '')}`].filter(Boolean).join(' · ')

  return (
    <div className="print-page min-h-dvh bg-night py-4 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center gap-2 px-4">
        <button onClick={() => nav(-1)} className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/5 px-3 text-sm font-semibold text-cream hover:bg-white/10">
          <ArrowLeft className="size-4" /> Indietro
        </button>
        <span className="hidden flex-1 text-xs text-muted sm:block">Per inviarla su WhatsApp o email scegli "Salva come PDF" nella finestra di stampa.</span>
        <button onClick={() => window.print()} className="ml-auto inline-flex h-10 items-center gap-2 rounded-xl bg-gold px-4 text-sm font-semibold text-ink hover:bg-gold-soft">
          <Printer className="size-4" /> Stampa o salva PDF
        </button>
      </div>

      <article className="sheet mx-auto max-w-[210mm] bg-white px-[12mm] py-[12mm] text-[#0b1730] shadow-2xl print:max-w-none print:px-1 print:py-0 print:shadow-none">
        <header className="flex items-center gap-4 border-b-4 border-[#032143] pb-4">
          <Logo size={72} />
          <div className="min-w-0 flex-1">
            <div className="font-varsity text-2xl leading-none text-[#032143]">{settings?.name ?? 'OldSchool Gym'}</div>
            {contacts && <div className="mt-1 text-xs text-[#4a5568]">{contacts}</div>}
          </div>
          {plan.goal && <span className="rounded-md bg-[#F5C518] px-3 py-1 text-sm font-bold uppercase tracking-wide text-[#032143]">{plan.goal}</span>}
        </header>

        <section className="mt-5">
          <h1 className="font-display text-4xl uppercase leading-none text-[#032143]">{plan.title}</h1>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[#4a5568]">
            {plan.client && (
              <span>
                Atleta: <strong className="text-[#0b1730]">{fullName(plan.client)}</strong>
              </span>
            )}
            {plan.starts_on && <span>Dal {fmtDate(plan.starts_on)}</span>}
            {plan.ends_on && <span>Al {fmtDate(plan.ends_on)}</span>}
          </div>
          {plan.notes && <p className="mt-3 whitespace-pre-line rounded-lg bg-[#FCF8ED] p-3 text-sm">{plan.notes}</p>}
        </section>

        {days.map(([day, items]) => (
          <section key={day} className="mt-6">
            <h2 className="day-title mb-2 bg-[#032143] px-3 py-1.5 font-display text-xl uppercase tracking-wide text-white">{day}</h2>
            <ol className="divide-y divide-[#e2e8f0]">
              {items.map((it, i) => {
                const ex = it.exercises
                const video = safeLink(ex?.video_url)
                const imgs = (ex?.images ?? []).slice(0, 2)
                return (
                  <li key={it.id} className="exercise flex gap-3 py-3">
                    <div className="w-6 shrink-0 pt-0.5 font-display text-xl text-[#F5C518] [-webkit-text-stroke:0.6px_#032143]">{i + 1}</div>
                    {imgs.length > 0 && (
                      <div className="flex shrink-0 gap-1.5">
                        {imgs.map((p, n) => (
                          <img key={p} src={exerciseImg(p) ?? ''} alt="" className={`size-16 rounded-md object-cover sm:size-[26mm] print:size-[26mm] ${n ? 'hidden sm:block print:block' : ''}`} />
                        ))}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-base font-bold leading-tight">{it.exercise_name}</div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-sm">
                        <Pill strong>
                          {it.sets} × {it.reps}
                        </Pill>
                        {it.rest_sec ? <Pill>Recupero {it.rest_sec}"</Pill> : null}
                        {it.load_note && <Pill>Carico {it.load_note}</Pill>}
                        {ex?.equipment && <Pill>{ex.equipment}</Pill>}
                      </div>
                      {it.notes && <div className="mt-1.5 text-sm font-semibold text-[#032143]">{it.notes}</div>}
                      {ex?.description && <p className="mt-1 line-clamp-3 text-xs text-[#4a5568]">{ex.description}</p>}
                    </div>
                    {video && (
                      <div className="hidden shrink-0 flex-col items-center gap-0.5 sm:flex print:flex">
                        <QRCodeSVG value={video} size={64} fgColor="#032143" />
                        <span className="text-[9px] text-[#4a5568]">Video</span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          </section>
        ))}

        <footer className="mt-8 flex items-center justify-between border-t border-[#e2e8f0] pt-3 text-[10px] text-[#718096]">
          <span>Scheda preparata dal tuo trainer · non modificare i carichi senza parlarne in sala</span>
          {days.some(([, items]) => items.some((it) => safeLink(it.exercises?.video_url))) && <span>Inquadra i QR per vedere i video</span>}
        </footer>
      </article>
    </div>
  )
}

function Pill({ children, strong }: { children: React.ReactNode; strong?: boolean }) {
  return <span className={strong ? 'rounded bg-[#F5C518] px-2 py-0.5 font-bold text-[#032143]' : 'rounded bg-[#edf2f7] px-2 py-0.5 text-[#2d3748]'}>{children}</span>
}
