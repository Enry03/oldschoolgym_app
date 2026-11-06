import { motion } from 'framer-motion'
import { Eye, EyeOff, Mail } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, Field, Input, Logo } from '../../components/ui'
import { useAuth } from '../../context/AuthContext'
import { errMsg, supabase } from '../../lib/supabase'

function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="grain relative grid min-h-dvh place-items-center overflow-hidden px-5 py-10">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(43,91,168,0.5),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(245,197,24,0.15),transparent_60%)]" />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="relative w-full max-w-sm">
        <Link to="/" className="mx-auto mb-6 block w-fit">
          <motion.div initial={{ scale: 0.7, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 12 }}>
            <Logo size={120} />
          </motion.div>
        </Link>
        <h1 className="text-center font-display text-4xl uppercase">{title}</h1>
        {subtitle && <p className="mt-1 text-center text-sm text-muted">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </motion.div>
    </div>
  )
}

function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} {...props} className="pr-11" />
      <button type="button" aria-label={show ? 'Nascondi password' : 'Mostra password'} onClick={() => setShow(!show)} className="absolute inset-y-0 right-3 text-muted hover:text-cream">
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export function Login() {
  const { session, isStaff, profile } = useAuth()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)

  if (session && profile) return <Navigate to={loc.state?.from ?? (isStaff ? '/staff' : '/app')} replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Bentornato! 💪')
    nav(loc.state?.from ?? '/app', { replace: true })
  }

  return (
    <AuthShell title="Bentornato" subtitle="Accedi al tuo account OldSchool">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <PasswordInput autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <div className="text-right">
          <Link to="/password-dimenticata" className="text-sm text-gold hover:underline">
            Password dimenticata?
          </Link>
        </div>
        <Button type="submit" block size="lg" loading={busy}>
          Accedi
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Non hai un account?{' '}
        <Link to="/registrati" className="font-semibold text-gold">
          Registrati
        </Link>
      </p>
    </AuthShell>
  )
}

export function Register() {
  const { session } = useAuth()
  const [params] = useSearchParams()
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '', email: '', password: '', referral_code: params.get('ref') ?? '' })
  const [privacy, setPrivacy] = useState(false)
  const [marketing, setMarketing] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  if (session) return <Navigate to="/app" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!privacy) return toast.error("Per registrarti devi accettare l'informativa privacy")
    if (f.password.length < 8) return toast.error('La password deve avere almeno 8 caratteri')
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: f.email.trim(),
      password: f.password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: {
          first_name: f.first_name.trim(),
          last_name: f.last_name.trim(),
          phone: f.phone.trim(),
          referral_code: f.referral_code.trim(),
          consent_privacy: true,
          consent_marketing: marketing,
        },
      },
    })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    if (!data.session) setSent(true)
    else toast.success('Benvenuto in squadra! 🥊')
  }

  if (sent)
    return (
      <AuthShell title="Controlla la posta" subtitle={`Ti abbiamo inviato un link di conferma a ${f.email}`}>
        <div className="card flex flex-col items-center gap-3 p-6 text-center">
          <Mail className="size-10 text-gold" />
          <p className="text-sm text-muted">Apri l'email e tocca il link per attivare l'account. Controlla anche lo spam.</p>
          <Link to="/accedi" className="w-full">
            <Button block variant="outline">
              Vai al login
            </Button>
          </Link>
        </div>
      </AuthShell>
    )

  return (
    <AuthShell title="Unisciti" subtitle="Crea il tuo account in 30 secondi">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Nome">
            <Input required autoComplete="given-name" maxLength={80} value={f.first_name} onChange={(e) => setF({ ...f, first_name: e.target.value })} />
          </Field>
          <Field label="Cognome">
            <Input required autoComplete="family-name" maxLength={80} value={f.last_name} onChange={(e) => setF({ ...f, last_name: e.target.value })} />
          </Field>
        </div>
        <Field label="Telefono">
          <Input type="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
        </Field>
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </Field>
        <Field label="Password" hint="Almeno 8 caratteri">
          <PasswordInput autoComplete="new-password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </Field>
        <Field label="Codice amico (facoltativo)">
          <Input value={f.referral_code} maxLength={12} onChange={(e) => setF({ ...f, referral_code: e.target.value.toUpperCase() })} />
        </Field>
        <div className="space-y-2 rounded-2xl bg-surface/60 p-3 text-xs text-cream/80">
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#F5C518]" checked={privacy} onChange={(e) => setPrivacy(e.target.checked)} />
            <span>
              Ho letto l'
              <Link to="/privacy" className="text-gold underline">
                informativa privacy
              </Link>{' '}
              e acconsento al trattamento dei miei dati per la gestione dell'iscrizione. <b>(obbligatorio)</b>
            </span>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#F5C518]" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} />
            <span>Voglio ricevere promozioni ed eventi della palestra. (facoltativo)</span>
          </label>
        </div>
        <Button type="submit" block size="lg" loading={busy}>
          Crea account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted">
        Hai già un account?{' '}
        <Link to="/accedi" className="font-semibold text-gold">
          Accedi
        </Link>
      </p>
    </AuthShell>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/nuova-password` })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    setSent(true)
  }
  return (
    <AuthShell title="Recupera accesso" subtitle="Ti mandiamo un link per scegliere una nuova password">
      {sent ? (
        <div className="card p-6 text-center text-sm text-muted">Se l'email è registrata, riceverai il link entro pochi minuti.</div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Button type="submit" block size="lg" loading={busy}>
            Invia link
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/accedi" className="text-gold">
          Torna al login
        </Link>
      </p>
    </AuthShell>
  )
}

export function UpdatePassword() {
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session))
    const { data } = supabase.auth.onAuthStateChange((evt) => {
      if (evt === 'PASSWORD_RECOVERY' || evt === 'SIGNED_IN') setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])
  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) return toast.error('Almeno 8 caratteri')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) return toast.error(errMsg(error))
    toast.success('Password aggiornata')
    nav('/app')
  }
  return (
    <AuthShell title="Nuova password">
      {!ready ? (
        <div className="card p-6 text-center text-sm text-muted">Link non valido o scaduto. Richiedine uno nuovo.</div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nuova password" hint="Almeno 8 caratteri">
            <PasswordInput required minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" block size="lg" loading={busy}>
            Salva
          </Button>
        </form>
      )}
    </AuthShell>
  )
}
