import { forgetPushOnLogout, syncPush } from '../lib/push'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { GymSettings, Profile } from '../lib/types'

interface AuthState {
  session: Session | null
  profile: Profile | null
  settings: GymSettings | null
  loading: boolean
  isStaff: boolean
  isFront: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  refreshSettings: () => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [settings, setSettings] = useState<GymSettings | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (uid?: string) => {
    if (!uid) {
      setProfile(null)
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle()
    setProfile((data as Profile) ?? null)
    if (data) void syncPush(uid)
  }, [])

  const refreshSettings = useCallback(async () => {
    const { data } = await supabase.from('gym_settings').select('*').eq('id', 1).maybeSingle()
    if (data) setSettings(data as GymSettings)
  }, [])

  useEffect(() => {
    let mounted = true
    refreshSettings()
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s)
      // evita deadlock: carica il profilo fuori dalla callback
      setTimeout(() => loadProfile(s?.user.id), 0)
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile, refreshSettings])

  const role = profile?.role
  const value: AuthState = {
    session,
    profile,
    settings,
    loading,
    isStaff: role === 'admin' || role === 'trainer' || role === 'reception',
    isFront: role === 'admin' || role === 'reception',
    isAdmin: role === 'admin',
    refreshProfile: () => loadProfile(session?.user.id),
    refreshSettings,
    signOut: async () => {
      await forgetPushOnLogout()
      await supabase.auth.signOut()
      setProfile(null)
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth fuori da AuthProvider')
  return c
}
