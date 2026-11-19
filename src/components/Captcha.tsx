import { useEffect, useRef } from 'react'

// Cloudflare Turnstile: verifica "non sono un robot" senza puzzle, gratis.
// Si attiva solo se è impostata VITE_TURNSTILE_SITE_KEY (su Vercel) e, lato Supabase,
// Authentication → Attack Protection → Captcha con la chiave segreta.
// La chiave del sito è pubblica per design; la segreta resta solo in Supabase.
export const CAPTCHA_SITE_KEY: string | undefined = import.meta.env.VITE_TURNSTILE_SITE_KEY || undefined

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string
      reset: (id?: string) => void
      remove: (id?: string) => void
    }
  }
}

let loading: Promise<void> | null = null
function loadScript() {
  if (window.turnstile) return Promise.resolve()
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => {
      loading = null
      reject(new Error('captcha'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/** Mostra il controllo anti robot. `resetKey`: cambialo dopo ogni invio per ottenere un nuovo token. */
export function Captcha({ onToken, resetKey = 0 }: { onToken: (t: string | null) => void; resetKey?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const id = useRef<string | null>(null)
  const cb = useRef(onToken)
  cb.current = onToken

  useEffect(() => {
    if (!CAPTCHA_SITE_KEY || !box.current) return
    let cancelled = false
    loadScript()
      .then(() => {
        if (cancelled || !box.current || !window.turnstile) return
        id.current = window.turnstile.render(box.current, {
          sitekey: CAPTCHA_SITE_KEY,
          theme: 'dark',
          language: 'it',
          callback: (t: string) => cb.current(t),
          'expired-callback': () => cb.current(null),
          'error-callback': () => cb.current(null),
        })
      })
      .catch(() => cb.current(null))
    return () => {
      cancelled = true
      if (id.current && window.turnstile) window.turnstile.remove(id.current)
      id.current = null
    }
  }, [])

  useEffect(() => {
    if (resetKey && id.current && window.turnstile) {
      cb.current(null)
      window.turnstile.reset(id.current)
    }
  }, [resetKey])

  if (!CAPTCHA_SITE_KEY) return null
  return <div ref={box} className="flex min-h-[65px] justify-center" />
}
