import { motion } from 'framer-motion'
import { Sun } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { Avatar, Badge, Logo } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { daysUntil, fmtDate, fullName } from '../../lib/format'
import { useMyMembership } from './Home'

export default function QrPass() {
  const { profile } = useAuth()
  const { data: m } = useMyMembership(profile?.id)
  const left = daysUntil(m?.end_date)
  const ok = m && m.status === 'active' && (left === null || left >= 0)
  return (
    <div className="flex min-h-[78dvh] flex-col items-center justify-center text-center">
      <motion.div initial={{ opacity: 0, scale: 0.9, rotateX: 30 }} animate={{ opacity: 1, scale: 1, rotateX: 0 }} transition={{ type: 'spring', stiffness: 140, damping: 16 }} className="w-full max-w-xs">
        <div className="grain relative overflow-hidden rounded-[2rem] bg-cream p-6 text-ink shadow-[0_30px_80px_-30px_rgba(245,197,24,0.6)]">
          <div className="absolute inset-x-0 top-0 h-2 bg-gold" />
          <div className="flex items-center gap-3">
            <Avatar p={profile} size={48} />
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate font-display text-2xl uppercase leading-none">{fullName(profile)}</div>
              <div className="text-xs text-ink/60">{m?.plan_name ?? 'Nessun abbonamento'}</div>
            </div>
            <Logo size={44} />
          </div>
          <motion.div className="relative mx-auto mt-6 w-fit rounded-3xl bg-white p-4" initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring' }}>
            {profile && <QRCodeSVG value={`OSG:${profile.qr_token}`} size={210} level="M" fgColor="#0B2A55" bgColor="#ffffff" />}
            <motion.div className="pointer-events-none absolute inset-x-4 h-0.5 rounded-full bg-gold shadow-[0_0_12px_#F5C518]" initial={{ top: 16 }} animate={{ top: [16, 226, 16] }} transition={{ repeat: Infinity, duration: 2.6, ease: 'easeInOut' }} />
          </motion.div>
          <div className="mt-5 flex items-center justify-center gap-2">
            {ok ? (
              <span className="flex items-center gap-2 rounded-full bg-success/20 px-3 py-1.5 text-sm font-bold text-emerald-700">
                <span className="size-2 animate-[pulse-ring_2s_ease-out_infinite] rounded-full bg-success" /> Accesso valido
              </span>
            ) : (
              <Badge tone="red" className="!text-sm">
                Abbonamento non attivo
              </Badge>
            )}
          </div>
          {m?.end_date && <div className="mt-2 text-xs text-ink/60">Scadenza {fmtDate(m.end_date)}</div>}
        </div>
      </motion.div>
      <p className="mt-6 flex items-center gap-2 text-sm text-muted">
        <Sun className="size-4" /> Alza la luminosità e mostra il codice in reception
      </p>
    </div>
  )
}
