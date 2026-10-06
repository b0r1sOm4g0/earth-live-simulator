// Busca o frame mais recente do GOES-19 Full Disk GEOCOLOR no CDN da NOAA.
// O CDN libera CORS (access-control-allow-origin: *), então o navegador busca direto.
// Em qualquer falha, usa um frame embutido em public/fallback/.

export const GOES_FD_BASE = 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR'
export const FALLBACK_FRAME_URL = '/fallback/goes-fd-1808.jpg'
const STALE_AFTER_MINUTES = 60

export type GoesResolution = 1808 | 5424
export type FrameStatus = 'fresh' | 'stale'

export interface GoesFrame {
  url: string
  /** Horário UTC da imagem; null quando é o fallback (horário desconhecido). */
  time: Date | null
  isFallback: boolean
}

/** "YYYYDDDHHMM_..." → Date UTC. Ex.: 20262790340 = 2026, dia 279, 03:40. */
export function parseGoesTimestamp(filename: string): Date | null {
  const m = /^(\d{4})(\d{3})(\d{2})(\d{2})_/.exec(filename)
  if (!m) return null
  const [year, doy, hour, minute] = m.slice(1).map(Number) as [number, number, number, number]
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
  if (doy < 1 || doy > (isLeap ? 366 : 365) || hour > 23 || minute > 59) return null
  return new Date(Date.UTC(year, 0, doy, hour, minute))
}

/** Nome do arquivo mais recente da resolução pedida na listagem HTML do diretório. */
export function latestFrameFile(listingHtml: string, res: GoesResolution): string | null {
  const pattern = new RegExp(`\\d{11}_GOES19-ABI-FD-GEOCOLOR-${res}x${res}\\.jpg`, 'g')
  const files = [...new Set(listingHtml.match(pattern) ?? [])].sort()
  return files.at(-1) ?? null
}

/** Escolhe a resolução que cabe na GPU. */
export function pickResolution(maxTextureSize: number): GoesResolution {
  return maxTextureSize >= 8192 ? 5424 : 1808
}

/** Idade do frame em minutos inteiros; nunca negativa. */
export function frameAgeMinutes(frameTime: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - frameTime.getTime()) / 60_000))
}

export function frameStatus(frameTime: Date | null, now: Date): FrameStatus {
  if (!frameTime) return 'stale'
  return frameAgeMinutes(frameTime, now) > STALE_AFTER_MINUTES ? 'stale' : 'fresh'
}

const FALLBACK: GoesFrame = { url: FALLBACK_FRAME_URL, time: null, isFallback: true }

/** Descobre o frame mais recente. Nunca rejeita: em falha devolve o fallback. */
export async function fetchLatestFrame(res: GoesResolution, fetchFn: typeof fetch = fetch): Promise<GoesFrame> {
  try {
    const response = await fetchFn(`${GOES_FD_BASE}/`)
    if (!response.ok) return { ...FALLBACK }
    const file = latestFrameFile(await response.text(), res)
    if (!file) return { ...FALLBACK }
    return { url: `${GOES_FD_BASE}/${file}`, time: parseGoesTimestamp(file), isFallback: false }
  } catch {
    return { ...FALLBACK }
  }
}
