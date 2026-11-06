import { AnimatePresence, motion } from 'framer-motion'
import { Cookie } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, PageHeader } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'

function LegalShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <PageHeader title={title} back />
      <div className="card space-y-4 p-5 text-sm leading-relaxed text-cream/85 [&_h2]:mt-4 [&_h2]:font-display [&_h2]:text-xl [&_h2]:uppercase [&_h2]:text-cream">{children}</div>
      <p className="mt-4 text-xs text-muted">Testo base da far verificare al proprio consulente privacy prima della pubblicazione definitiva.</p>
    </div>
  )
}

export function Privacy() {
  const { settings } = useAuth()
  return (
    <LegalShell title="Privacy">
      <p>
        Informativa ai sensi degli artt. 13-14 del Regolamento UE 2016/679 (GDPR). Titolare del trattamento: <b>{settings?.name ?? 'OldSchool Gym'}</b>, {settings?.address}. Contatto: {settings?.email}.
      </p>
      <h2>Quali dati trattiamo</h2>
      <p>Dati anagrafici e di contatto, dati dell'abbonamento e dei pagamenti, presenze e prenotazioni, schede di allenamento, misurazioni fisiche facoltative, certificato medico sportivo (dato relativo alla salute) e foto dei progressi che decidi di caricare.</p>
      <h2>Perché</h2>
      <p>Per gestire iscrizione, accessi, prenotazioni e allenamenti (esecuzione del contratto), per adempiere agli obblighi di legge (certificato medico, contabilità) e, solo con il tuo consenso, per inviarti promozioni.</p>
      <h2>Chi vede i tuoi dati</h2>
      <p>Solo il personale autorizzato della palestra: la reception e l'amministrazione per la parte amministrativa, il tuo personal trainer per schede e progressi. Le foto dei progressi sono visibili solo a te. I dati sono ospitati su server nell'Unione Europea (Supabase, Francoforte).</p>
      <h2>Per quanto tempo</h2>
      <p>Per la durata del rapporto e fino a 10 anni per i dati contabili. Puoi eliminare il tuo account in qualsiasi momento dal profilo.</p>
      <h2>I tuoi diritti</h2>
      <p>Accesso, rettifica, cancellazione, portabilità (esporti i dati in JSON dal profilo), opposizione e revoca dei consensi in qualsiasi momento. Puoi anche presentare reclamo al Garante Privacy.</p>
    </LegalShell>
  )
}

export function CookiePolicy() {
  return (
    <LegalShell title="Cookie">
      <p>Questa app usa solo strumenti tecnici necessari al funzionamento: la memoria locale del browser per mantenerti collegato e la cache per funzionare anche con connessione debole.</p>
      <p>Non usiamo cookie di profilazione né strumenti di tracciamento pubblicitario. Per questo non serve il tuo consenso, ma ti informiamo con un banner alla prima visita.</p>
    </LegalShell>
  )
}

export function CookieBanner() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    try {
      setShow(!localStorage.getItem('osg-cookie-ok'))
    } catch {
      setShow(false)
    }
  }, [])
  const accept = () => {
    try {
      localStorage.setItem('osg-cookie-ok', '1')
    } catch {
      /* ignore */
    }
    setShow(false)
  }
  return (
    <AnimatePresence>
      {show && (
        <motion.div initial={{ y: 120, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 120, opacity: 0 }} className="fixed inset-x-3 bottom-24 z-[60] mx-auto max-w-md rounded-2xl border border-line bg-night/95 p-4 shadow-2xl backdrop-blur md:bottom-6">
          <div className="flex gap-3">
            <Cookie className="size-6 shrink-0 text-gold" />
            <p className="text-xs text-cream/80">
              Usiamo solo strumenti tecnici per farti restare collegato. Niente tracciamento pubblicitario.{' '}
              <Link to="/cookie" className="text-gold underline">
                Dettagli
              </Link>
            </p>
          </div>
          <Button size="sm" block className="mt-3" onClick={accept}>
            Ho capito
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
