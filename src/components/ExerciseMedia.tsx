import clsx from 'clsx'
import { Dumbbell, PlayCircle } from 'lucide-react'
import { useState } from 'react'
import { publicUrl, supabase } from '../lib/supabase'
import type { ExerciseMedia } from '../lib/types'

/** Le foto degli esercizi stanno nel bucket pubblico "media", cartella exercises/ (scrive solo lo staff). */
export const exerciseImg = (path?: string | null) => publicUrl('media', path)

/** Solo link http(s): un "javascript:" nel campo video non deve mai diventare un link cliccabile. */
export function safeLink(url?: string | null) {
  if (!url) return null
  try {
    const u = new URL(url.trim())
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

/** Ridimensiona la foto (lato lungo 1280px, WebP) e la carica. Restituisce il percorso da salvare sull'esercizio. */
export async function uploadExercisePhoto(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Scegli una foto (JPG, PNG o WebP)')
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.82))
  if (!blob) throw new Error('Foto non leggibile, prova con un altro file')
  const path = `exercises/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from('media').upload(path, blob, { contentType: 'image/webp', cacheControl: '31536000' })
  if (error) throw error
  return path
}

export async function removeExercisePhotos(paths: string[]) {
  const own = paths.filter((p) => p.startsWith('exercises/'))
  if (own.length) await supabase.storage.from('media').remove(own)
}

/** Miniatura quadrata: prima foto dell'esercizio, altrimenti un'icona. */
export function ExerciseThumb({ media, className }: { media?: Pick<ExerciseMedia, 'images'> | null; className?: string }) {
  const src = exerciseImg(media?.images?.[0])
  return src ? (
    <img src={src} alt="" loading="lazy" className={clsx('shrink-0 rounded-lg bg-surface-2 object-cover', className)} />
  ) : (
    <div className={clsx('grid shrink-0 place-items-center rounded-lg bg-surface-2 text-muted', className)}>
      <Dumbbell className="size-4" />
    </div>
  )
}

/** Foto grandi, link al video e spiegazione dell'esecuzione: si vede ovunque compare l'esercizio. */
export function ExerciseDetails({ media, name }: { media?: ExerciseMedia | null; name: string }) {
  const [big, setBig] = useState(0)
  if (!media) return null
  const imgs = media.images ?? []
  const video = safeLink(media.video_url)
  if (!imgs.length && !video && !media.description) return null
  return (
    <div className="space-y-3">
      {imgs.length > 0 && (
        <div>
          <img src={exerciseImg(imgs[big]) ?? ''} alt={`${name}, foto ${big + 1}`} className="aspect-[4/3] w-full rounded-2xl bg-surface-2 object-cover" />
          {imgs.length > 1 && (
            <div className="mt-2 flex gap-2">
              {imgs.map((p, i) => (
                <button key={p} type="button" aria-label={`Foto ${i + 1}`} aria-pressed={i === big} onClick={() => setBig(i)} className={clsx('overflow-hidden rounded-lg border-2', i === big ? 'border-gold' : 'border-transparent opacity-70')}>
                  <img src={exerciseImg(p) ?? ''} alt="" className="size-14 object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {video && (
        <a href={video} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl bg-night p-3 text-sm font-semibold text-cream hover:text-gold">
          <PlayCircle className="size-5 text-gold" /> Guarda il video dell'esecuzione
        </a>
      )}
      {media.description && <p className="whitespace-pre-line text-sm text-cream/80">{media.description}</p>}
    </div>
  )
}
