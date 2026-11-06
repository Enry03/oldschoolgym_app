import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'
import type { Notification } from './types'

/** Caricamento asincrono semplice con reload */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const fnRef = useRef(fn)
  fnRef.current = fn

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await fnRef.current())
      setError(null)
    } catch (e) {
      setError((e as Error).message ?? 'Errore')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error, reload, setData }
}

/** Lancia l'errore Supabase se presente, altrimenti restituisce i dati */
export function must<T>(res: { data: T | null; error: unknown }): T {
  if (res.error) throw res.error
  return res.data as T
}

/** Notifiche in tempo reale per l'utente corrente */
export function useNotifications(userId?: string) {
  const [items, setItems] = useState<Notification[]>([])
  const load = useCallback(async () => {
    if (!userId) return
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(60)
    setItems((data as Notification[]) ?? [])
  }, [userId])

  useEffect(() => {
    if (!userId) return
    load()
    const ch = supabase
      .channel(`notif-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [userId, load])

  const unread = items.filter((n) => !n.read_at).length
  const markAllRead = async () => {
    if (!userId) return
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null)
    load()
  }
  return { items, unread, reload: load, markAllRead }
}
