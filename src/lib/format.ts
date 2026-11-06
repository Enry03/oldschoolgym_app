import { differenceInCalendarDays, format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

export const euro = (cents: number | null | undefined) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: cents && cents % 100 ? 2 : 0 }).format((cents ?? 0) / 100)

const d = (v: string | Date) => (typeof v === 'string' ? parseISO(v) : v)

export const fmtDate = (v?: string | Date | null, f = 'd MMM yyyy') => (v ? format(d(v), f, { locale: it }) : '—')
export const fmtTime = (v: string | Date) => format(d(v), 'HH:mm', { locale: it })
export const fmtDay = (v: string | Date) => format(d(v), 'EEEE d MMMM', { locale: it })
export const fmtRelative = (v: string | Date) => formatDistanceToNowStrict(d(v), { locale: it, addSuffix: true })
export const daysUntil = (v?: string | null) => (v ? differenceInCalendarDays(parseISO(v), new Date()) : null)
export const isoDate = (v: Date = new Date()) => format(v, 'yyyy-MM-dd')

export const fullName = (p?: { first_name?: string | null; last_name?: string | null } | null) =>
  p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Senza nome' : '—'

export const initials = (p?: { first_name?: string | null; last_name?: string | null } | null) =>
  p ? `${(p.first_name ?? '').charAt(0)}${(p.last_name ?? '').charAt(0)}`.toUpperCase() || 'OS' : 'OS'

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const roleLabel: Record<string, string> = {
  admin: 'Amministratore',
  trainer: 'Personal trainer',
  reception: 'Reception',
  client: 'Cliente',
}

export const methodLabel: Record<string, string> = {
  cash: 'Contanti',
  card: 'Carta / POS',
  transfer: 'Bonifico',
  other: 'Altro',
}

export const bookingLabel: Record<string, string> = {
  booked: 'Prenotato',
  waitlist: "In lista d'attesa",
  cancelled: 'Disdetto',
  attended: 'Presente',
  no_show: 'Assente',
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Buongiorno'
  if (h < 18) return 'Buon pomeriggio'
  return 'Buonasera'
}

/** Scarica un array di oggetti come CSV (separatore ; per Excel italiano) */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v)
    // neutralizza formule (CSV injection)
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
    return /[;"\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
  }
  const csv = '﻿' + [headers.join(';'), ...rows.map((r) => headers.map((h) => esc(r[h])).join(';'))].join('\n')
  downloadBlob(filename, new Blob([csv], { type: 'text/csv;charset=utf-8' }))
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
