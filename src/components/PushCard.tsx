import { AnimatePresence, motion } from 'framer-motion'
import { BellRing, Share, SquarePlus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { disablePush, enablePush, getPushState, type PushState } from '../lib/push'
import { Button, Sheet, Toggle } from './ui'

const DISMISS_KEY = 'osg-push-dismissed'

function usePushState() {
  const [state, setState] = useState<PushState | null>(null)
  useEffect(() => {
    getPushState().then(setState).catch(() => setState('unsupported'))
  }, [])
  return [state, setState] as const
}

function IosHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Notifiche su iPhone">
      <p className="text-sm text-cream/80">Su iPhone le notifiche funzionano solo se l'app è installata nella schermata Home. Bastano 3 passaggi in Safari:</p>
      <ol className="mt-4 space-y-3 text-sm">
        <li className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-white/5 text-gold"><Share className="size-4" /></span>
          Tocca <b>Condividi</b> in basso
        </li>
        <li className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-white/5 text-gold"><SquarePlus className="size-4" /></span>
          Scegli <b>Aggiungi alla schermata Home</b>
        </li>
        <li className="flex items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-white/5 text-gold"><BellRing className="size-4" /></span>
          Apri l'app dall'icona e attiva le notifiche dal profilo
        </li>
      </ol>
    </Sheet>
  )
}

async function toggle(on: boolean, userId: string, set: (s: PushState) => void) {
  try {
    const s = on ? await enablePush(userId) : await disablePush()
    set(s)
    if (s === 'on') toast.success('Notifiche attive su questo telefono 🔔')
    else if (s === 'denied') toast.error('Notifiche bloccate: abilitale dalle impostazioni del telefono per questa app')
    else if (!on) toast('Notifiche disattivate su questo telefono')
  } catch {
    toast.error('Non è stato possibile attivare le notifiche. Riprova.')
  }
}

/** Interruttore per il profilo */
export function PushToggle() {
  const { profile } = useAuth()
  const [state, setState] = usePushState()
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState(false)
  if (!profile || state === null || state === 'unsupported') return null

  return (
    <div className="px-4 py-2">
      {state === 'ios-install' ? (
        <button onClick={() => setHelp(true)} className="flex w-full items-center gap-3 py-1 text-left">
          <span className="flex-1">
            <span className="block text-[15px] font-medium">Notifiche sul telefono</span>
            <span className="block text-xs text-muted">Installa l'app nella schermata Home per attivarle</span>
          </span>
          <span className="text-sm font-semibold text-gold">Come fare</span>
        </button>
      ) : (
        <div className={busy ? 'pointer-events-none opacity-60' : ''}>
          <Toggle
            checked={state === 'on'}
            label="Notifiche sul telefono"
            desc={state === 'denied' ? 'Bloccate: riattivale dalle impostazioni del telefono' : 'Promemoria lezioni, posti liberi, scadenze e messaggi'}
            onChange={async (v) => {
              if (state === 'denied') return
              setBusy(true)
              await toggle(v, profile.id, setState)
              setBusy(false)
            }}
          />
        </div>
      )}
      <IosHelp open={help} onClose={() => setHelp(false)} />
    </div>
  )
}

/** Invito in home, finché non attivate o nascoste */
export function PushBanner() {
  const { profile } = useAuth()
  const [state, setState] = usePushState()
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState(false)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })
  const show = !!profile && !hidden && (state === 'off' || state === 'ios-install')

  function dismiss() {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignora */
    }
  }

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="mb-4 overflow-hidden"
          >
            <div className="relative flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 p-3 pr-10">
              <motion.span
                animate={{ rotate: [0, -14, 12, -8, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 3 }}
                className="grid size-10 shrink-0 place-items-center rounded-xl bg-gold text-ink"
              >
                <BellRing className="size-5" />
              </motion.span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold">Non perderti nessuna lezione</div>
                <div className="text-xs text-cream/70">Ricevi promemoria e posti liberi sul telefono.</div>
              </div>
              <Button
                size="sm"
                loading={busy}
                onClick={async () => {
                  if (state === 'ios-install') return setHelp(true)
                  setBusy(true)
                  await toggle(true, profile!.id, setState)
                  setBusy(false)
                }}
              >
                Attiva
              </Button>
              <button aria-label="Nascondi" onClick={dismiss} className="absolute right-2 top-2 grid size-7 place-items-center rounded-full text-muted hover:text-cream">
                <X className="size-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <IosHelp open={help} onClose={() => setHelp(false)} />
    </>
  )
}
