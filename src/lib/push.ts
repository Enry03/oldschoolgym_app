import { supabase } from './supabase'

export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ?? ''

export type PushState = 'unsupported' | 'ios-install' | 'denied' | 'off' | 'on'

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

function urlBase64ToUint8Array(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function registration() {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready)
}

export async function getPushState(): Promise<PushState> {
  if (!VAPID_PUBLIC_KEY) return 'unsupported'
  const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!hasApi) return isIos() && !isStandalone() ? 'ios-install' : 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

async function save(sub: PushSubscription, userId: string) {
  const j = sub.toJSON()
  // un dispositivo = una iscrizione: se l'endpoint esisteva (anche di un altro utente sullo stesso telefono) lo rimpiazza
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  const { error } = await supabase.from('push_subscriptions').insert({
    user_id: userId,
    endpoint: sub.endpoint,
    p256dh: j.keys?.p256dh ?? '',
    auth: j.keys?.auth ?? '',
    user_agent: navigator.userAgent.slice(0, 280),
  })
  if (error) throw error
}

export async function enablePush(userId: string): Promise<PushState> {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'off'
  const reg = await registration()
  if (!reg) return 'unsupported'
  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
  }
  await save(sub, userId)
  return 'on'
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
  return 'off'
}

/** Dopo il login riallinea l'iscrizione di questo telefono all'utente corrente. */
export async function syncPush(userId: string) {
  try {
    if ((await getPushState()) !== 'on') return
    const sub = await (await registration())?.pushManager.getSubscription()
    if (!sub) return
    const { data } = await supabase.from('push_subscriptions').select('id').eq('endpoint', sub.endpoint).eq('user_id', userId).maybeSingle()
    if (!data) await save(sub, userId)
  } catch {
    /* non bloccare l'app */
  }
}

/** Al logout il telefono smette di ricevere le notifiche dell'account. */
export async function forgetPushOnLogout() {
  try {
    const sub = await (await registration())?.pushManager.getSubscription()
    if (sub) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  } catch {
    /* ignora */
  }
}
