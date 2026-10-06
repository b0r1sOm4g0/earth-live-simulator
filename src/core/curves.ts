// Curvas que transformam altitude em "quanto" de cada efeito aplicar.
// Tudo é interpolado em escala logarítmica: descer de 1000 km para 100 km
// "pesa" o mesmo que descer de 100 km para 10 km.

export const GOES_GROUND_FADE = { from: 5_000_000, to: 500_000 } as const
export const GOES_CLOUD_FADE = { from: 500_000, to: 30_000 } as const
export const TILT_RAMP = { from: 50_000, to: 150, maxDeg: 35 } as const

/**
 * 0 quando altitude >= from, 1 quando altitude <= to (com from > to),
 * transição suave (smoothstep) em log(altitude).
 */
export function logRamp(altitude: number, from: number, to: number): number {
  if (!Number.isFinite(altitude) || altitude <= 0) return 1
  const t = (Math.log(from) - Math.log(altitude)) / (Math.log(from) - Math.log(to))
  const c = Math.min(1, Math.max(0, t))
  return c * c * (3 - 2 * c)
}

/** Opacidade dos pixels "de chão" (não-nuvem) da imagem GOES. */
export function goesGroundOpacity(altitude: number): number {
  return 1 - logRamp(altitude, GOES_GROUND_FADE.from, GOES_GROUND_FADE.to)
}

/** Opacidade das nuvens da imagem GOES. */
export function goesCloudOpacity(altitude: number): number {
  return 1 - logRamp(altitude, GOES_CLOUD_FADE.from, GOES_CLOUD_FADE.to)
}

/** Inclinação automática da câmera (graus a partir do nadir). */
export function tiltDegAt(altitude: number): number {
  return TILT_RAMP.maxDeg * logRamp(altitude, TILT_RAMP.from, TILT_RAMP.to)
}
