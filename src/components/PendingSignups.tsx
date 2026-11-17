import { AnimatePresence, motion } from 'framer-motion'
import { Check, Mail, Phone, UserCheck, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { fmtDate, fullName } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { Avatar, Button, Field, Input, SectionTitle, Sheet } from './ui'

// Iscrizioni fatte dall'app che aspettano l'ok dell'admin.
// L'approvazione passa dalla funzione review_signup, che nel database controlla che chi la chiama sia admin.
export default function PendingSignups() {
  const { data, reload } = useAsync(async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .eq('approval_status', 'pending')
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data as Profile[]) ?? []
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<Profile | null>(null)
  const [reason, setReason] = useState('')

  async function review(p: Profile, approve: boolean, why?: string) {
    setBusy(p.id)
    const { error } = await supabase.rpc('review_signup', { p_user: p.id, p_approve: approve, p_reason: why ?? null })
    setBusy(null)
    if (error) return toast.error(error.message)
    toast.success(approve ? `${fullName(p)} approvato` : 'Iscrizione rifiutata')
    setRejecting(null)
    setReason('')
    reload()
  }

  if (!data?.length) return null
  return (
    <div className="mt-6">
      <SectionTitle>
        <span className="flex items-center gap-2">
          <UserCheck className="size-4 text-gold" /> Iscrizioni da approvare ({data.length})
        </span>
      </SectionTitle>
      <p className="mb-3 text-xs text-muted">Approva solo chi conosci o ha mostrato un documento in reception. Finché non approvi, l'account non può fare nulla.</p>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {data.map((p) => (
            <motion.div key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="card flex flex-wrap items-center gap-3 p-3">
              <Avatar p={p} size={44} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{fullName(p) || 'Senza nome'}</div>
                <div className="flex flex-wrap gap-x-3 text-xs text-muted">
                  {p.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="size-3" /> {p.email}
                    </span>
                  )}
                  {p.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="size-3" /> {p.phone}
                    </span>
                  )}
                  <span>Registrato il {fmtDate(p.created_at, 'd/M HH:mm')}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="danger" aria-label="Rifiuta" disabled={busy === p.id} onClick={() => setRejecting(p)} icon={<X className="size-4" />}>
                  Rifiuta
                </Button>
                <Button size="sm" loading={busy === p.id} onClick={() => review(p, true)} icon={<Check className="size-4" />}>
                  Approva
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <Sheet
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title={`Rifiuta ${rejecting ? fullName(rejecting) : ''}`}
        footer={
          <Button block size="lg" variant="danger" loading={!!rejecting && busy === rejecting.id} onClick={() => rejecting && review(rejecting, false, reason)}>
            Rifiuta iscrizione
          </Button>
        }
      >
        <Field label="Motivo (facoltativo)" hint="Lo vedrà la persona quando apre l'app">
          <Input maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Es. non risulti iscritto in palestra" />
        </Field>
      </Sheet>
    </div>
  )
}
