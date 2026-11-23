import { AnimatePresence, m } from 'motion/react'
import { AlertTriangle, Camera, Check, Mail, Phone, UserCheck, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '../context/AuthContext'
import { ageYears, fmtDate, fullName } from '../lib/format'
import { useAsync } from '../lib/hooks'
import { errMsg, supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { Avatar, Badge, Button, Field, Input, SectionTitle, Sheet } from './ui'

// Riduce la foto (lato lungo 640px, JPEG) prima del caricamento: più leggera e senza dati EXIF/GPS
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 640 / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas')
  c.width = Math.round(bmp.width * scale)
  c.height = Math.round(bmp.height * scale)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('foto'))), 'image/jpeg', 0.85))
}

// Iscrizioni fatte dall'app che aspettano l'ok dell'admin.
// L'approvazione passa da review_signup, che nel database controlla: admin, età, regolamento,
// consenso sanitario, foto e (per i minorenni) modulo del genitore.
export default function PendingSignups() {
  const { settings } = useAuth()
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
  const [approving, setApproving] = useState<Profile | null>(null)
  const [guardianOk, setGuardianOk] = useState(false)
  const [reason, setReason] = useState('')
  const fileFor = useRef<Profile | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const adultAge = settings?.adult_age ?? 18
  const needPhoto = settings?.require_photo_for_approval ?? true

  async function review(p: Profile, approve: boolean, why?: string, guardian = false) {
    setBusy(p.id)
    const { error } = await supabase.rpc('review_signup', { p_user: p.id, p_approve: approve, p_reason: why ?? null, p_guardian_ok: guardian })
    setBusy(null)
    if (error) return toast.error(errMsg(error))
    toast.success(approve ? `${fullName(p)} approvato` : 'Iscrizione rifiutata')
    setRejecting(null)
    setApproving(null)
    setGuardianOk(false)
    setReason('')
    reload()
  }

  async function uploadPhoto(file: File) {
    const p = fileFor.current
    if (!p) return
    setBusy(p.id)
    try {
      const blob = await shrink(file)
      const path = `${p.id}/avatar-${Date.now()}.jpg`
      const { error } = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true })
      if (error) throw error
      const { error: e2 } = await supabase.from('profiles').update({ avatar_url: path }).eq('id', p.id)
      if (e2) throw e2
      toast.success('Foto salvata')
      reload()
    } catch (e) {
      toast.error(errMsg(e))
    } finally {
      setBusy(null)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  if (!data?.length) return null
  return (
    <div className="mt-6">
      <SectionTitle>
        <span className="flex items-center gap-2">
          <UserCheck className="size-4 text-gold" /> Iscrizioni da approvare ({data.length})
        </span>
      </SectionTitle>
      <p className="mb-3 text-xs text-muted">
        Approva solo chi è passato in reception con un documento. {needPhoto ? 'Prima scatta la foto: serve per riconoscerlo all’ingresso. ' : ''}Finché non approvi, l'account non può fare nulla.
      </p>
      <input
        ref={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && uploadPhoto(e.target.files[0])}
      />
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {data.map((p) => {
            const age = ageYears(p.birth_date)
            const minor = age !== null && age < adultAge
            const missing = [
              age === null && 'data di nascita',
              !p.rules_version && 'regolamento',
              !p.consent_health && 'consenso sanitario',
              needPhoto && !p.avatar_url && 'foto',
              minor && !p.guardian_name && 'dati genitore',
            ].filter(Boolean) as string[]
            return (
              <m.div key={p.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -20 }} className="card space-y-3 p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    aria-label="Scatta la foto"
                    className="relative"
                    onClick={() => {
                      fileFor.current = p
                      fileInput.current?.click()
                    }}
                  >
                    <Avatar p={p} size={52} />
                    <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full bg-gold text-ink">
                      <Camera className="size-3.5" />
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{fullName(p) || 'Senza nome'}</span>
                      {age !== null && <Badge tone={minor ? 'gold' : 'gray'}>{age} anni{minor ? ' · minorenne' : ''}</Badge>}
                    </div>
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
                    {minor && p.guardian_name && (
                      <div className="mt-1 text-xs text-cream/80">
                        Genitore: {p.guardian_name}
                        {p.guardian_phone ? ` · ${p.guardian_phone}` : ''}
                      </div>
                    )}
                  </div>
                </div>
                {missing.length > 0 && (
                  <div className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-cream/90">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-danger" />
                    <span>
                      Manca: {missing.join(', ')}.{' '}
                      {missing.includes('foto') ? 'Tocca la foto per scattarla. ' : ''}
                      {missing.some((m) => m !== 'foto') ? 'Completa i dati dalla scheda del cliente.' : ''}
                    </span>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="danger" aria-label="Rifiuta" disabled={busy === p.id} onClick={() => setRejecting(p)} icon={<X className="size-4" />}>
                    Rifiuta
                  </Button>
                  <Button
                    size="sm"
                    loading={busy === p.id}
                    onClick={() => (minor ? (setGuardianOk(false), setApproving(p)) : review(p, true))}
                    icon={<Check className="size-4" />}
                  >
                    Approva
                  </Button>
                </div>
              </m.div>
            )
          })}
        </AnimatePresence>
      </div>
      <Sheet
        open={!!approving}
        onClose={() => setApproving(null)}
        title={`Approva ${approving ? fullName(approving) : ''}`}
        footer={
          <Button block size="lg" disabled={!guardianOk} loading={!!approving && busy === approving.id} onClick={() => approving && review(approving, true, undefined, true)}>
            Approva iscrizione
          </Button>
        }
      >
        <p className="text-sm text-muted">È minorenne: si approva solo con il modulo di consenso firmato da un genitore, da conservare in reception.</p>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5 size-4 accent-[#F5C518]" checked={guardianOk} onChange={(e) => setGuardianOk(e.target.checked)} />
          <span>
            Ho il modulo firmato da {approving?.guardian_name ?? 'un genitore'} e ho controllato il suo documento.
          </span>
        </label>
      </Sheet>
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
