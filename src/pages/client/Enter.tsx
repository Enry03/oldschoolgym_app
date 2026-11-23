import { AnimatePresence, m } from 'motion/react'
import { Camera, CheckCircle2, QrCode, ScanLine, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Button } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { fmtDate } from '../../lib/format'
import { errMsg, supabase } from '../../lib/supabase'

interface Result {
  status: 'ok' | 'duplicate' | 'denied' | 'used' | 'expired' | 'invalid' | 'rate_limited'
  allowed: boolean
  reason: string | null
  name?: string
  plan?: string | null
  end_date?: string | null
  entries_left?: number | null
}

// Esiti per cui conviene continuare a inquadrare (il tablet ha già un QR nuovo)
const RETRY = new Set(['used', 'expired'])

export default function Enter() {
  const { profile } = useAuth()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controls = useRef<{ stop: () => void } | null>(null)
  const tried = useRef(new Set<string>())
  const busy = useRef(false)
  const [on, setOn] = useState(false)
  const [hint, setHint] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  const stop = useCallback(() => {
    controls.current?.stop()
    controls.current = null
    setOn(false)
  }, [])
  useEffect(() => () => controls.current?.stop(), [])

  const submit = useCallback(
    async (code: string) => {
      if (busy.current || tried.current.has(code)) return
      busy.current = true
      tried.current.add(code)
      const { data, error } = await supabase.rpc('kiosk_checkin', { p_code: code })
      busy.current = false
      if (error) {
        tried.current.delete(code)
        setHint(errMsg(error))
        return
      }
      const r = data as Result
      if (RETRY.has(r.status)) {
        setHint(r.reason)
        return
      }
      stop()
      setResult(r)
      navigator.vibrate?.(r.allowed ? 120 : [120, 80, 120])
    },
    [stop],
  )

  async function start() {
    setResult(null)
    setHint(null)
    tried.current.clear()
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser')
      const reader = new BrowserQRCodeReader()
      setOn(true)
      controls.current = await reader.decodeFromConstraints({ audio: false, video: { facingMode: { ideal: 'environment' } } }, videoRef.current!, (res) => {
        const text = res?.getText()
        if (!text) return
        const m = text.trim().match(/^OSGK:([0-9a-f]{32})$/)
        if (m) submit(m[1])
        else if (text.startsWith('OSG:')) setHint('Questo è un QR personale: inquadra quello sul tablet all\'ingresso')
        else setHint('QR non riconosciuto: inquadra quello sul tablet all\'ingresso')
      })
    } catch (e) {
      setOn(false)
      setHint('Impossibile accedere alla fotocamera: ' + errMsg(e) + '. Controlla i permessi del browser.')
    }
  }

  return (
    <div className="flex min-h-[78dvh] flex-col items-center text-center">
      <div className="label mt-2 text-gold">Check-in</div>
      <h1 className="text-2xl font-semibold leading-none">Entra in palestra</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">Inquadra il QR sul tablet all'ingresso. Cambia ogni 30 secondi, quindi serve essere lì.</p>

      <div className="relative mt-6 aspect-square w-full max-w-sm overflow-hidden rounded-3xl bg-night">
        <video ref={videoRef} className={`size-full object-cover ${on ? '' : 'hidden'}`} muted playsInline />
        {!on && !result && (
          <button onClick={start} className="grid size-full place-items-center">
            <div>
              <div className="mx-auto grid size-24 place-items-center rounded-full bg-gold text-ink">
                <ScanLine className="size-11" />
              </div>
              <p className="mt-4 font-semibold">Tocca per aprire la fotocamera</p>
            </div>
          </button>
        )}
        {on && (
          <>
            <div className="pointer-events-none absolute inset-10 rounded-3xl border-2 border-gold/80" />
            <m.div className="pointer-events-none absolute inset-x-10 h-0.5 bg-gold shadow-[0_0_16px_#F5C518]" animate={{ top: ['12%', '86%', '12%'] }} transition={{ repeat: Infinity, duration: 2.4, ease: 'easeInOut' }} />
          </>
        )}
        <AnimatePresence>
          {result && (
            <m.div initial={{ opacity: 0, scale: 1.08 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className={`absolute inset-0 grid place-items-center p-6 ${result.allowed ? 'bg-success text-ink' : 'bg-danger text-white'}`}>
              <div className="flex flex-col items-center">
                <m.div initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}>
                  {result.allowed ? <CheckCircle2 className="size-20" /> : <XCircle className="size-20" />}
                </m.div>
                {result.name && (
                  <div className="mt-3 flex items-center gap-2">
                    <Avatar p={profile} size={40} />
                    <span className="text-xl font-semibold leading-none">{result.name}</span>
                  </div>
                )}
                <div className="mt-3 text-lg font-bold">
                  {result.status === 'ok' && 'Ingresso registrato. Buon allenamento!'}
                  {result.status === 'duplicate' && 'Eri già entrato: tutto a posto'}
                  {!result.allowed && result.reason}
                </div>
                {result.allowed && result.plan && (
                  <div className="mt-1 text-sm opacity-80">
                    {result.plan}
                    {result.end_date && ` · fino al ${fmtDate(result.end_date)}`}
                    {result.entries_left != null && ` · ${result.entries_left} ingressi rimasti`}
                  </div>
                )}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {hint && !result && <p className="mt-3 max-w-sm text-sm text-gold">{hint}</p>}

      <div className="mt-5 w-full max-w-sm">
        {on ? (
          <Button block variant="ghost" onClick={stop}>
            Chiudi fotocamera
          </Button>
        ) : (
          <Button block size="lg" icon={<Camera className="size-5" />} onClick={start}>
            {result ? 'Inquadra di nuovo' : 'Inquadra il QR'}
          </Button>
        )}
      </div>

      <Link to="/app/qr" className="mt-6 flex items-center gap-2 text-sm text-muted underline-offset-4 hover:underline">
        <QrCode className="size-4" /> Fotocamera non funziona? Mostra il tuo pass allo staff
      </Link>
    </div>
  )
}
