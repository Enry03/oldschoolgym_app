import { AnimatePresence, motion } from 'framer-motion'
import { Camera, CameraOff, CheckCircle2, Search, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Avatar, Button, Input, PageHeader, SectionTitle } from '../../components/ui'
import { fmtDate, fullName } from '../../lib/format'
import { errMsg, supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'

interface Result {
  found: boolean
  allowed: boolean
  duplicate?: boolean
  reason: string | null
  name?: string
  avatar_url?: string | null
  plan?: string | null
  end_date?: string | null
  entries_left?: number | null
  certificate_ok?: boolean
}

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = ok ? 880 : 220
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.setValueAtTime(0.15, ctx.currentTime)
    o.start()
    o.stop(ctx.currentTime + (ok ? 0.15 : 0.4))
    navigator.vibrate?.(ok ? 80 : [100, 60, 100])
  } catch {
    /* audio non disponibile */
  }
}

export default function Checkin() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controls = useRef<{ stop: () => void } | null>(null)
  const busy = useRef(false)
  const [on, setOn] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Profile[]>([])

  const doCheckin = useCallback(async (token: string) => {
    if (busy.current) return
    busy.current = true
    const { data, error } = await supabase.rpc('checkin', { p_token: token })
    if (error) {
      toast.error(errMsg(error))
    } else {
      const r = data as Result
      setResult(r)
      beep(r.allowed)
      setTimeout(() => setResult(null), 4000)
    }
    setTimeout(() => (busy.current = false), 2500)
  }, [])

  async function start() {
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader()
      setOn(true)
      controls.current = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (res) => {
        const text = res?.getText()
        if (!text) return
        const m = text.match(/^OSG:([0-9a-f-]{36})$/i)
        if (m) doCheckin(m[1])
      })
    } catch (e) {
      setOn(false)
      toast.error('Impossibile accedere alla fotocamera: ' + errMsg(e))
    }
  }
  function stop() {
    controls.current?.stop()
    controls.current = null
    setOn(false)
  }
  useEffect(() => () => controls.current?.stop(), [])

  useEffect(() => {
    const s = q.trim()
    if (s.length < 2) return setFound([])
    const t = setTimeout(async () => {
      const like = `%${s.replace(/[%_,()]/g, '')}%`
      const { data } = await supabase.from('profiles').select('*').or(`first_name.ilike.${like},last_name.ilike.${like},phone.ilike.${like}`).limit(8)
      setFound((data as Profile[]) ?? [])
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  return (
    <div>
      <PageHeader title="Check-in" kicker="Scansiona il QR del cliente" />
      <div className="relative mx-auto aspect-square max-w-sm overflow-hidden rounded-3xl bg-night">
        <video ref={videoRef} className={`size-full object-cover ${on ? '' : 'hidden'}`} muted playsInline />
        {!on && (
          <div className="grid size-full place-items-center">
            <div className="text-center">
              <Camera className="mx-auto size-12 text-gold" />
              <p className="mt-3 text-sm text-muted">Attiva la fotocamera per leggere i QR</p>
            </div>
          </div>
        )}
        {on && (
          <>
            <div className="pointer-events-none absolute inset-10 rounded-3xl border-2 border-gold/80" />
            <motion.div className="pointer-events-none absolute inset-x-10 h-0.5 bg-gold shadow-[0_0_16px_#F5C518]" animate={{ top: ['12%', '86%', '12%'] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }} />
          </>
        )}
        <AnimatePresence>
          {result && (
            <motion.div initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 grid place-items-center p-6 text-center ${result.allowed ? 'bg-success/95 text-ink' : 'bg-danger/95 text-white'}`}>
              <div>
                <motion.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                  {result.allowed ? <CheckCircle2 className="mx-auto size-20" /> : <XCircle className="mx-auto size-20" />}
                </motion.div>
                {result.found && (
                  <div className="mt-3 flex flex-col items-center">
                    <Avatar p={{ first_name: result.name?.split(' ')[0], last_name: result.name?.split(' ')[1], avatar_url: result.avatar_url }} size={56} />
                    <div className="mt-2 font-display text-3xl uppercase leading-none">{result.name}</div>
                  </div>
                )}
                <div className="mt-2 text-lg font-bold">{result.allowed ? (result.duplicate ? 'Già entrato' : 'Benvenuto!') : result.reason}</div>
                {result.plan && (
                  <div className="mt-1 text-sm opacity-80">
                    {result.plan}
                    {result.end_date && ` · fino al ${fmtDate(result.end_date)}`}
                    {result.entries_left != null && ` · ${result.entries_left} ingressi`}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="mx-auto mt-4 max-w-sm">
        {on ? (
          <Button block variant="ghost" icon={<CameraOff className="size-4" />} onClick={stop}>
            Ferma fotocamera
          </Button>
        ) : (
          <Button block size="lg" icon={<Camera className="size-5" />} onClick={start}>
            Avvia scanner
          </Button>
        )}
      </div>

      <SectionTitle>Check-in manuale</SectionTitle>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input className="pl-10" placeholder="Cerca cliente per nome o telefono" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="mt-3 space-y-2">
        {found.map((p) => (
          <div key={p.id} className="card flex items-center gap-3 p-3">
            <Avatar p={p} size={40} />
            <div className="flex-1 font-semibold">{fullName(p)}</div>
            <Button size="sm" onClick={() => doCheckin(p.qr_token)}>
              Registra ingresso
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
