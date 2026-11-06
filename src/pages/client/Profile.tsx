import { motion } from 'framer-motion'
import { Bell, Camera, ChevronRight, CreditCard, Download, FileHeart, Gift, KeyRound, LogOut, MessageCircle, Newspaper, Shield, Trash2, Upload } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Avatar, Badge, Button, Field, Input, PageHeader, SectionTitle, Select, Sheet, Toggle } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { daysUntil, downloadBlob, fmtDate, fullName, isoDate, roleLabel } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { errMsg, signedUrl, SUPABASE_URL, supabase } from '../../lib/supabase'
import type { Certificate } from '../../lib/types'

function Row({ icon, label, to, onClick, right, danger }: { icon: ReactNode; label: string; to?: string; onClick?: () => void; right?: ReactNode; danger?: boolean }) {
  const inner = (
    <>
      <span className={`grid size-10 place-items-center rounded-xl ${danger ? 'bg-danger/15 text-danger' : 'bg-white/5 text-gold'}`}>{icon}</span>
      <span className={`flex-1 text-[15px] font-medium ${danger ? 'text-danger' : ''}`}>{label}</span>
      {right ?? <ChevronRight className="size-4 text-muted" />}
    </>
  )
  const cls = 'flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/5'
  return to ? (
    <Link to={to} className={cls}>
      {inner}
    </Link>
  ) : (
    <button onClick={onClick} className={cls}>
      {inner}
    </button>
  )
}

export default function Profile() {
  const { profile, refreshProfile, signOut } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [edit, setEdit] = useState(false)
  const [pwd, setPwd] = useState(false)
  const [del, setDel] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (loc.hash === '#certificato') document.getElementById('certificato')?.scrollIntoView({ behavior: 'smooth' })
  }, [loc.hash])

  async function uploadAvatar(file: File) {
    if (file.size > 5 * 1024 * 1024) return toast.error('Immagine troppo grande (max 5 MB)')
    setUploading(true)
    const path = `${profile!.id}/avatar-${Date.now()}.${file.type.split('/')[1] ?? 'jpg'}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
    if (error) {
      setUploading(false)
      return toast.error(errMsg(error))
    }
    await supabase.from('profiles').update({ avatar_url: path }).eq('id', profile!.id)
    await refreshProfile()
    setUploading(false)
    toast.success('Foto aggiornata')
  }

  async function exportData() {
    const { data, error } = await supabase.rpc('export_my_data')
    if (error) return toast.error(errMsg(error))
    downloadBlob(`oldschoolgym-dati-${isoDate()}.json`, new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    toast.success('Dati esportati')
  }

  return (
    <div>
      <PageHeader title="Profilo" />
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="card flex items-center gap-4 p-5">
        <label className="relative cursor-pointer">
          <Avatar p={profile} size={76} ring />
          <span className="absolute -bottom-1 -right-1 grid size-8 place-items-center rounded-full bg-gold text-ink ring-4 ring-surface">
            {uploading ? <Upload className="size-4 animate-bounce" /> : <Camera className="size-4" />}
          </span>
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])} />
        </label>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-2xl uppercase leading-none">{fullName(profile)}</div>
          <div className="mt-1 truncate text-sm text-muted">{profile?.email}</div>
          <Badge tone="gold" className="mt-2">
            {roleLabel[profile?.role ?? 'client']}
          </Badge>
        </div>
      </motion.div>
      <Button variant="ghost" block className="mt-3" onClick={() => setEdit(true)}>
        Modifica dati personali
      </Button>

      <SectionTitle>La mia palestra</SectionTitle>
      <div className="card divide-y divide-line/40 overflow-hidden p-0">
        <Row icon={<CreditCard className="size-5" />} label="Abbonamento e ricevute" to="/app/abbonamento" />
        <Row icon={<Bell className="size-5" />} label="Notifiche" to="/app/notifiche" />
        <Row icon={<MessageCircle className="size-5" />} label="Messaggi con il trainer" to="/app/messaggi" />
        <Row icon={<Newspaper className="size-5" />} label="Bacheca news" to="/app/news" />
        <Row icon={<Gift className="size-5" />} label="Porta un amico" to="/app/invita" />
      </div>

      <div id="certificato" className="scroll-mt-6">
        <CertificateBlock />
      </div>

      <SectionTitle>Account e privacy</SectionTitle>
      <div className="card divide-y divide-line/40 overflow-hidden p-0">
        <Row icon={<KeyRound className="size-5" />} label="Cambia password" onClick={() => setPwd(true)} />
        <Row icon={<Shield className="size-5" />} label="Consensi privacy" onClick={() => setPrivacy(true)} />
        <Row icon={<Download className="size-5" />} label="Esporta i miei dati" onClick={exportData} />
        <Row icon={<LogOut className="size-5" />} label="Esci" onClick={async () => { await signOut(); nav('/') }} />
        <Row icon={<Trash2 className="size-5" />} label="Elimina account" danger onClick={() => setDel(true)} />
      </div>
      <div className="mt-6 flex justify-center gap-4 text-xs text-muted">
        <Link to="/privacy">Privacy</Link>
        <Link to="/cookie">Cookie</Link>
      </div>

      <EditSheet open={edit} onClose={() => setEdit(false)} />
      <PasswordSheet open={pwd} onClose={() => setPwd(false)} />
      <PrivacySheet open={privacy} onClose={() => setPrivacy(false)} />
      <DeleteSheet open={del} onClose={() => setDel(false)} />
    </div>
  )
}

function EditSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, refreshProfile } = useAuth()
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '', birth_date: '', gender: '' })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (profile) setF({ first_name: profile.first_name, last_name: profile.last_name, phone: profile.phone ?? '', birth_date: profile.birth_date ?? '', gender: profile.gender ?? '' })
  }, [profile, open])
  async function save() {
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ ...f, birth_date: f.birth_date || null, gender: f.gender || null }).eq('id', profile!.id)
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    await refreshProfile()
    toast.success('Profilo aggiornato')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="I tuoi dati" footer={<Button block size="lg" loading={busy} onClick={save}>Salva</Button>}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome">
            <Input value={f.first_name} maxLength={80} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
          </Field>
          <Field label="Cognome">
            <Input value={f.last_name} maxLength={80} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
          </Field>
        </div>
        <Field label="Telefono">
          <Input type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data di nascita">
            <Input type="date" value={f.birth_date} onChange={(e) => setF({ ...f, birth_date: e.target.value })} />
          </Field>
          <Field label="Genere">
            <Select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
              <option value="">—</option>
              <option value="M">Uomo</option>
              <option value="F">Donna</option>
              <option value="X">Altro</option>
            </Select>
          </Field>
        </div>
      </div>
    </Sheet>
  )
}

function PasswordSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [p, setP] = useState('')
  const [p2, setP2] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    if (p.length < 8) return toast.error('Almeno 8 caratteri')
    if (p !== p2) return toast.error('Le password non coincidono')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: p })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Password cambiata')
    setP('')
    setP2('')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Cambia password" footer={<Button block size="lg" loading={busy} onClick={save}>Aggiorna</Button>}>
      <div className="space-y-3">
        <Field label="Nuova password">
          <Input type="password" autoComplete="new-password" value={p} onChange={(e) => setP(e.target.value)} />
        </Field>
        <Field label="Ripeti password">
          <Input type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  )
}

function PrivacySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, refreshProfile } = useAuth()
  async function set(k: 'consent_marketing' | 'consent_photos', v: boolean) {
    const { error } = await supabase.from('profiles').update({ [k]: v }).eq('id', profile!.id)
    if (error) return toast.error(errMsg(error))
    refreshProfile()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Consensi">
      <div className="divide-y divide-line/40">
        <div className="py-3 text-sm">
          <div className="font-medium">Trattamento dati per il servizio</div>
          <div className="text-xs text-muted">Necessario per usare l'app. Accettato il {fmtDate(profile?.consent_at)}.</div>
        </div>
        <Toggle label="Promozioni ed eventi" desc="Comunicazioni commerciali della palestra" checked={!!profile?.consent_marketing} onChange={(v) => set('consent_marketing', v)} />
        <Toggle label="Foto e video sui social" desc="Possiamo pubblicare foto in cui compari durante eventi" checked={!!profile?.consent_photos} onChange={(v) => set('consent_photos', v)} />
      </div>
      <p className="mt-4 text-xs text-muted">
        Puoi modificare i consensi in qualsiasi momento. Leggi l'<Link to="/privacy" className="text-gold underline">informativa</Link>.
      </p>
    </Sheet>
  )
}

function DeleteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { signOut } = useAuth()
  const nav = useNavigate()
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  async function del() {
    setBusy(true)
    const { data } = await supabase.auth.getSession()
    const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${data.session?.access_token}`, 'Content-Type': 'application/json' },
    })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      return toast.error(j.error ?? "Impossibile eliminare l'account")
    }
    await signOut()
    toast.success('Account eliminato. Ci mancherai 🥊')
    nav('/')
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Elimina account"
      footer={
        <Button variant="danger" block size="lg" loading={busy} disabled={confirm !== 'ELIMINA'} onClick={del}>
          Elimina definitivamente
        </Button>
      }
    >
      <p className="text-sm text-cream/80">Verranno cancellati per sempre profilo, schede, progressi, foto, prenotazioni e messaggi. I dati contabili dei pagamenti possono essere conservati dalla palestra per obblighi di legge.</p>
      <Field label='Scrivi "ELIMINA" per confermare'>
        <Input value={confirm} onChange={(e) => setConfirm(e.target.value.toUpperCase())} />
      </Field>
    </Sheet>
  )
}

function CertificateBlock() {
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [expires, setExpires] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const { data: certs, reload } = useAsync(async () => {
    const { data } = await supabase.from('medical_certificates').select('*').eq('user_id', profile!.id).order('expires_on', { ascending: false })
    return (data as Certificate[]) ?? []
  }, [profile?.id])
  const cur = certs?.[0]
  const left = daysUntil(cur?.expires_on)

  async function upload() {
    if (!file || !expires) return toast.error('Scegli il file e la data di scadenza')
    if (file.size > 10 * 1024 * 1024) return toast.error('File troppo grande (max 10 MB)')
    setBusy(true)
    const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1] ?? 'jpg'
    const path = `${profile!.id}/${crypto.randomUUID()}.${ext}`
    const up = await supabase.storage.from('certificates').upload(path, file, { contentType: file.type })
    if (up.error) {
      setBusy(false)
      return toast.error(errMsg(up.error))
    }
    const { error } = await supabase.from('medical_certificates').insert({ user_id: profile!.id, expires_on: expires, file_path: path })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Certificato caricato: la reception lo verificherà')
    setFile(null)
    setExpires('')
    reload()
  }
  async function view(c: Certificate) {
    const url = await signedUrl('certificates', c.file_path, 120)
    if (url) window.open(url, '_blank', 'noopener')
  }

  return (
    <>
      <SectionTitle>Certificato medico</SectionTitle>
      <div className="card p-4">
        <div className="flex items-center gap-3">
          <div className={`grid size-12 place-items-center rounded-2xl ${cur && left! >= 0 ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>
            <FileHeart className="size-6" />
          </div>
          <div className="flex-1">
            <div className="font-semibold">{cur ? `Scade il ${fmtDate(cur.expires_on)}` : 'Non caricato'}</div>
            <div className="text-xs text-muted">{cur ? (cur.verified ? 'Verificato dalla reception ✓' : 'In attesa di verifica') : 'Obbligatorio per accedere alla sala'}</div>
          </div>
          {cur?.file_path && (
            <Button size="sm" variant="ghost" onClick={() => view(cur)}>
              Apri
            </Button>
          )}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="flex h-12 cursor-pointer items-center justify-center gap-2 truncate rounded-xl border border-dashed border-line px-3 text-sm text-muted hover:border-gold">
            <Upload className="size-4 shrink-0" /> <span className="truncate">{file ? file.name : 'Scegli file'}</span>
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} aria-label="Data di scadenza" />
        </div>
        <Button block variant="outline" className="mt-3" loading={busy} onClick={upload}>
          Carica nuovo certificato
        </Button>
      </div>
    </>
  )
}
