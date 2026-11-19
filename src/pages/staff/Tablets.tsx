import { Copy, MonitorSmartphone, Plus, ShieldOff, Tablet } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge, Button, Card, Empty, Field, Input, Loading, PageHeader, SectionTitle, Sheet } from '../../components/ui'
import { fmtRelative } from '../../lib/format'
import { useAsync } from '../../lib/hooks'
import { errMsg, supabase } from '../../lib/supabase'

interface Device {
  id: string
  name: string
  created_at: string
  last_seen_at: string | null
  last_user_agent: string | null
  revoked_at: string | null
  checkins_today: number
}

export default function Tablets() {
  const [name, setName] = useState('Tablet ingresso')
  const [creating, setCreating] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const { data, loading, reload } = useAsync(async () => {
    const { data, error } = await supabase.rpc('admin_kiosk_list')
    if (error) throw error
    return (data as Device[]) ?? []
  })

  async function create() {
    setCreating(true)
    const { data: secret, error } = await supabase.rpc('admin_kiosk_create', { p_name: name })
    setCreating(false)
    if (error) return toast.error(errMsg(error))
    setLink(`${window.location.origin}/kiosk#${secret as string}`)
    reload()
  }

  async function revoke(d: Device) {
    if (!window.confirm(`Scollegare "${d.name}"? Il tablet smetterà subito di mostrare il QR.`)) return
    const { error } = await supabase.rpc('admin_kiosk_revoke', { p_id: d.id })
    if (error) return toast.error(errMsg(error))
    toast.success('Tablet scollegato')
    reload()
  }

  const online = (d: Device) => d.last_seen_at && Date.now() - new Date(d.last_seen_at).getTime() < 3 * 60_000

  return (
    <div>
      <PageHeader title="Tablet ingresso" kicker="Check-in con QR" back="/staff/altro" />
      <Card className="p-4">
        <p className="text-sm text-muted">
          Il tablet all'ingresso mostra un QR che cambia ogni 30 secondi ed è valido una sola volta. Il cliente lo inquadra dall'app con il pulsante <b>Entra</b>. Il tablet non ha accesso ai dati dei clienti: vede solo nome e foto di chi entra in quel momento.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Field label="Nome del tablet">
              <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
            </Field>
          </div>
          <Button icon={<Plus className="size-4" />} loading={creating} onClick={create}>
            Collega un tablet
          </Button>
        </div>
      </Card>

      <SectionTitle>Tablet collegati</SectionTitle>
      {loading && !data ? (
        <Loading rows={2} />
      ) : !data?.length ? (
        <Empty icon={<Tablet className="size-8" />} title="Nessun tablet" text="Collega il tablet Samsung dell'ingresso per attivare il check-in con QR." />
      ) : (
        <div className="space-y-2">
          {data.map((d) => (
            <Card key={d.id} className="flex items-center gap-3 p-4">
              <span className="grid size-11 place-items-center rounded-xl bg-gold/15 text-gold">
                <MonitorSmartphone className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-semibold">
                  {d.name}
                  {d.revoked_at ? <Badge tone="red">Scollegato</Badge> : online(d) ? <Badge tone="green">Online</Badge> : <Badge>Offline</Badge>}
                </div>
                <div className="truncate text-xs text-muted">
                  {d.last_seen_at ? `Ultimo contatto ${fmtRelative(d.last_seen_at)}` : 'Mai collegato'} · {d.checkins_today} ingressi oggi
                </div>
              </div>
              {!d.revoked_at && (
                <Button size="sm" variant="danger" icon={<ShieldOff className="size-4" />} onClick={() => revoke(d)}>
                  Scollega
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <Sheet open={!!link} onClose={() => setLink(null)} title="Apri questo link sul tablet">
        {link && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted">Inquadra il QR con la fotocamera del tablet (o copia il link e aprilo in Chrome sul tablet). Per sicurezza il link viene mostrato una sola volta: non mandarlo a nessuno.</p>
            <div className="mx-auto w-fit rounded-2xl bg-white p-4">
              <QRCodeSVG value={link} size={220} level="M" />
            </div>
            <Button
              variant="ghost"
              icon={<Copy className="size-4" />}
              onClick={() => navigator.clipboard.writeText(link).then(() => toast.success('Link copiato'))}
            >
              Copia link
            </Button>
          </div>
        )}
      </Sheet>
    </div>
  )
}
