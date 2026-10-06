// Faixas de escala: QUAL plataforma/sensor o jogador "está usando" em cada altitude.
// Ajustar a sensação do jogo = editar os números desta tabela.

export type BandId = 'GEO' | 'LEO' | 'HALE' | 'DRONE' | 'HOVER'

export interface ScaleBand {
  id: BandId
  /** Altitude mínima em metros (inclusiva). */
  minAltitude: number
  /** Altitude máxima em metros (exclusiva). */
  maxAltitude: number
  /** Nome exibido no HUD. */
  platform: string
  /** Sensor exibido no HUD. */
  sensor: string
  /** Campo de visão instantâneo de 1 pixel, em radianos. GSD = altitude × IFOV. */
  ifovRad: number
}

export const MAX_ALTITUDE = 36_000_000
export const MIN_ALTITUDE = 100

export const SCALE_BANDS: readonly ScaleBand[] = [
  { id: 'GEO', minAltitude: 1_000_000, maxAltitude: Infinity, platform: 'GOES-19 ABI', sensor: 'GEOCOLOR', ifovRad: 28e-6 },
  { id: 'LEO', minAltitude: 50_000, maxAltitude: 1_000_000, platform: 'Satélite LEO (classe Sentinel-2)', sensor: 'RGB', ifovRad: 12.7e-6 },
  { id: 'HALE', minAltitude: 5_000, maxAltitude: 50_000, platform: 'RQ-4 Global Hawk', sensor: 'RGB', ifovRad: 60e-6 },
  { id: 'DRONE', minAltitude: 200, maxAltitude: 5_000, platform: 'DJI Matrice 4TD', sensor: 'RGB', ifovRad: 216e-6 },
  { id: 'HOVER', minAltitude: -Infinity, maxAltitude: 200, platform: 'DJI Matrice 4TD', sensor: 'RGB', ifovRad: 216e-6 },
]

const LOWEST_BAND = SCALE_BANDS[SCALE_BANDS.length - 1]!

/** Faixa ativa para uma altitude (metros). Valores inválidos caem na faixa mais baixa. */
export function bandAt(altitude: number): ScaleBand {
  if (!Number.isFinite(altitude) && altitude !== Infinity) return LOWEST_BAND
  return SCALE_BANDS.find((b) => altitude >= b.minAltitude && altitude < b.maxAltitude) ?? LOWEST_BAND
}

/** GSD simulado (metros por pixel) do sensor da faixa ativa. */
export function gsdAt(altitude: number): number {
  if (!Number.isFinite(altitude) || altitude <= 0) return 0
  const clamped = Math.min(altitude, MAX_ALTITUDE)
  return clamped * bandAt(clamped).ifovRad
}
