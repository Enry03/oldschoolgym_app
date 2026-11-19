import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Maximize, ShieldAlert, Smartphone, WifiOff, XCircle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Logo } from '../../components/ui'
import { publicUrl, supabase } from '../../lib/supabase'

/**
 * Schermata del tablet all'ingresso (modalità kiosk).
 * Nessun utente loggato: il tablet si identifica con un segreto di dispositivo creato dall'admin
 * (link /kiosk#<segreto>, salvato solo in questo browser). Mostra un QR monouso che cambia ogni 30 s
 * e l'esito in tempo reale degli ingressi fatti con i suoi QR.
 */

const KEY = 'osg-kiosk-secret'
const POLL_MS = 1500

interface KioskEvent {
  id: number
  outcome: 'ok' | 'duplicate' | 'denied'
  name: string
  avatar_url: string | null
}
interface PollResult {
  device: string
  code: string
  expires_at: string
  server_time: string
  last_event_id: number
  events: KioskEvent[]
}

function readSecret(): string | null {
  const fromHash = window.location.hash.replace(/^#/, '')
  if (/^[0-9a-f]{64}$/.test(fromHash)) {
    try {
      localStorage.setItem(KEY, fromHash)
    } catch {
      /* storage non disponibile: resta valido per questa sessione */
    }
    // toglie il segreto dalla barra degli indirizzi e dalla cronologia
    history.replaceState(null, '', '/kiosk')
    return fromHash
  }
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function beep(ok: boolean) {
  try {
    const ctx = new AudioContext()
    const play = (freq: number, at: number, dur: number) => {
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.frequency.value = freq
      o.connect(g)
      g.connect(ctx.destination)
      g.gain.setValueAtTime(0.2, ctx.currentTime + at)
      o.start(ctx.currentTime + at)
      o.stop(ctx.currentTime + at + dur)
    }
    if (ok) {
      play(660, 0, 0.12)
      play(990, 0.13, 0.18)
    } else play(220, 0, 0.5)
  } catch {
    /* audio non disponibile */
  }
}

export default function Kiosk() {
  const [secret, setSecret] = useState<string | null>(() => readSecret())
  const [data, setData] = useState<PollResult | null>(null)
  const [offset, setOffset] = useState(0) // ora server - ora tablet
  const [now, setNow] = useState(Date.now())
  const [offline, setOffline] = useState(false)
  const [unauthorized, setUnauthorized] = useState(false)
  const [shown, setShown] = useState<KioskEvent | null>(null)
  const lastEvent = useRef<number | null>(null)
  const queue = useRef<KioskEvent[]>([])

  const poll = useCallback(async () => {
    if (!secret) return
    const { data: res, error } = await supabase.rpc('kiosk_poll', { p_secret: secret, p_after: lastEvent.current ?? 0 })
    if (error) {
      if (error.code === '28000' || error.message.includes('non autorizzato')) setUnauthorized(true)
      else setOffline(true)
      return
    }
    const r = res as PollResult
    setOffline(false)
    setUnauthorized(false)
    setOffset(new Date(r.server_time).getTime() - Date.now())
    setData(r)
    if (lastEvent.current === null) {
      // al primo avvio non mostra gli esiti vecchi
      lastEvent.current = r.last_event_id
      return
    }
    const fresh = r.events.filter((e) => e.id > (lastEvent.current ?? 0))
    if (fresh.length) {
      lastEvent.current = Math.max(...fresh.map((e) => e.id))
      queue.current.push(...fresh)
    }
  }, [secret])

  useEffect(() => {
    if (!secret) return
    poll()
    const t = setInterval(poll, POLL_MS)
    const c = setInterval(() => setNow(Date.now()), 250)
    return () => {
      clearInterval(t)
      clearInterval(c)
    }
  }, [secret, poll])

  // mostra un esito alla volta
  useEffect(() => {
    if (shown) {
      const t = setTimeout(() => setShown(null), shown.outcome === 'denied' ? 4500 : 3000)
      return () => clearTimeout(t)
    }
    const t = setInterval(() => {
      const next = queue.current.shift()
      if (next) {
        setShown(next)
        beep(next.outcome !== 'denied')
      }
    }, 200)
    return () => clearInterval(t)
  }, [shown])

  // schermo sempre acceso
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const acquire = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock?.request('screen')
      } catch {
        /* non supportato */
      }
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      document.removeEventListener('visibilitychange', acquire)
      lock?.release().catch(() => {})
    }
  }, [])

  // ricarica la pagina ogni notte per prendere gli aggiornamenti dell'app
  useEffect(() => {
    const t = setInterval(() => {
      const h = new Date().getHours()
      if (h === 4) location.reload()
    }, 30 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  function fullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {})
  }

  if (!secret || unauthorized) {
    return (
      <div className="grid min-h-dvh place-items-center bg-ink p-8 text-center text-cream">
        <div className="max-w-md">
          <ShieldAlert className="mx-auto size-16 text-gold" />
          <h1 className="mt-4 font-display text-4xl uppercase">Tablet non collegato</h1>
          <p className="mt-3 text-muted">
            Dall'app, come amministratore: <b>Altro → Tablet ingresso → Collega un tablet</b>, poi apri il link su questo tablet.
          </p>
          {unauthorized && (
            <button
              className="mt-6 text-sm text-muted underline"
              onClick={() => {
                try {
                  localStorage.removeItem(KEY)
                } catch {
                  /* ignore */
                }
                setSecret(null)
                setUnauthorized(false)
              }}
            >
              Il collegamento è stato revocato: dimentica questo tablet
            </button>
          )}
        </div>
      </div>
    )
  }

  const total = 30_000
  const left = data ? Math.max(0, new Date(data.expires_at).getTime() - (now + offset)) : 0
  const pct = data ? Math.min(1, left / total) : 0

  return (
    <div className="relative flex min-h-dvh select-none flex-col items-center justify-between overflow-hidden bg-ink p-6 text-cream" onDoubleClick={fullscreen}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-[radial-gradient(ellipse_at_top,rgba(245,197,24,0.18),transparent_70%)]" />
      <header className="relative flex w-full items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo size={64} />
          <div>
            <div className="font-display text-3xl uppercase leading-none tracking-wide">OldSchool Gym</div>
            <div className="label text-gold">Ingresso</div>
          </div>
        </div>
        <button aria-label="Schermo intero" onClick={fullscreen} className="rounded-xl bg-white/5 p-3 text-muted">
          <Maximize className="size-5" />
        </button>
      </header>

      <main className="relative flex flex-col items-center">
        <div className="relative rounded-[2rem] bg-white p-6 shadow-[0_30px_100px_-30px_rgba(245,197,24,0.7)]">
          {data ? (
            <motion.div key={data.code} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25 }}>
              <QRCodeSVG value={`OSGK:${data.code}`} size={Math.min(window.innerWidth, window.innerHeight) * 0.5} level="M" fgColor="#0B2A55" bgColor="#ffffff" />
            </motion.div>
          ) : (
            <div className="grid aspect-square w-[50vmin] place-items-center text-ink/40">Caricamento…</div>
          )}
          <div className="absolute inset-x-6 bottom-2 h-1.5 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-gold transition-[width] duration-200 ease-linear" style={{ width: `${pct * 100}%` }} />
          </div>
        </div>
        <div className="mt-8 flex items-center gap-3 text-center">
          <Smartphone className="size-8 text-gold" />
          <div className="text-left">
            <div className="font-display text-4xl uppercase leading-none">Apri l'app e tocca “Entra”</div>
            <div className="mt-1 text-lg text-muted">Inquadra il codice: il QR cambia da solo ogni 30 secondi</div>
          </div>
        </div>
      </main>

      <footer className="relative flex w-full items-center justify-between text-sm text-muted">
        <span>{data?.device}</span>
        {offline ? (
          <span className="flex items-center gap-2 text-danger">
            <WifiOff className="size-4" /> Connessione assente: chiedi in reception
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-success" /> Online
          </span>
        )}
      </footer>

      <AnimatePresence>
        {shown && (
          <motion.div
            key={shown.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute inset-0 z-20 grid place-items-center p-8 text-center ${shown.outcome === 'denied' ? 'bg-danger text-white' : shown.outcome === 'duplicate' ? 'bg-gold text-ink' : 'bg-success text-ink'}`}
          >
            <div className="flex flex-col items-center">
              <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 220, damping: 16 }} className="relative">
                <div className="size-[34vmin] overflow-hidden rounded-full border-8 border-white/80 bg-ink/20 shadow-2xl">
                  {shown.avatar_url ? (
                    <img src={publicUrl('avatars', shown.avatar_url) ?? ''} alt="" className="size-full object-cover" />
                  ) : (
                    <div className="grid size-full place-items-center font-varsity text-[12vmin]">{shown.name.slice(0, 1)}</div>
                  )}
                </div>
                <span className="absolute -bottom-3 -right-3 rounded-full bg-white p-2 text-ink shadow-xl">
                  {shown.outcome === 'denied' ? <XCircle className="size-14 text-danger" /> : <CheckCircle2 className="size-14 text-emerald-600" />}
                </span>
              </motion.div>
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="mt-8 font-display text-[9vmin] uppercase leading-none">
                {shown.outcome === 'denied' ? shown.name : `Ciao ${shown.name}!`}
              </motion.div>
              <div className="mt-4 text-[4vmin] font-bold">
                {shown.outcome === 'ok' && 'Ingresso registrato. Buon allenamento!'}
                {shown.outcome === 'duplicate' && 'Eri già entrato oggi'}
                {shown.outcome === 'denied' && 'Ingresso non consentito: passa in reception'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
