// Projeção "fixed grid" dos satélites GOES-R (GOES-16/18/19).
// Converte latitude/longitude em ângulos de varredura do instrumento ABI
// e esses ângulos em coordenadas de textura da imagem Full Disk.
// Fórmulas: GOES-R Product User Guide, Vol. 3, §4.2.8.
// O shader da camada GOES (spike/goesShell.ts) replica exatamente esta matemática.

export interface GeoSatellite {
  /** Longitude da origem da projeção (graus). GOES-East: −75,0. */
  lon0Deg: number
  /** Altura do satélite acima do equador (m). */
  perspectiveHeight: number
  /** Raio equatorial (m), GRS80. */
  rEq: number
  /** Raio polar (m), GRS80. */
  rPol: number
  /** Meia-extensão da varredura do Full Disk (rad), igual nos dois eixos. */
  extentRad: number
}

export const GOES_EAST: GeoSatellite = {
  lon0Deg: -75.0,
  perspectiveHeight: 35_786_023,
  rEq: 6_378_137,
  rPol: 6_356_752.31414,
  extentRad: 0.151872,
}

export interface ScanAngles {
  /** Ângulo leste-oeste (rad). */
  x: number
  /** Ângulo norte-sul (rad), positivo = norte. */
  y: number
}

const DEG = Math.PI / 180

/** lat/lon (graus) → ângulos de varredura; null se o satélite não enxerga o ponto. */
export function latLonToScan(latDeg: number, lonDeg: number, sat: GeoSatellite = GOES_EAST): ScanAngles | null {
  const { rEq, rPol } = sat
  const H = sat.perspectiveHeight + rEq
  const e2 = (rEq * rEq - rPol * rPol) / (rEq * rEq)

  const lat = latDeg * DEG
  const dLon = (lonDeg - sat.lon0Deg) * DEG

  // Latitude geocêntrica e raio da Terra naquele ponto.
  const latC = Math.atan(((rPol * rPol) / (rEq * rEq)) * Math.tan(lat))
  const rc = rPol / Math.sqrt(1 - e2 * Math.cos(latC) ** 2)

  // Vetor satélite → ponto, no referencial do satélite.
  const sx = H - rc * Math.cos(latC) * Math.cos(dLon)
  const sy = -rc * Math.cos(latC) * Math.sin(dLon)
  const sz = rc * Math.sin(latC)

  // Ponto escondido atrás do limbo da Terra?
  if (H * (H - sx) < sy * sy + ((rEq * rEq) / (rPol * rPol)) * sz * sz) return null

  return {
    x: Math.asin(-sy / Math.sqrt(sx * sx + sy * sy + sz * sz)),
    y: Math.atan(sz / sx),
  }
}

/** Ângulos de varredura → UV da imagem Full Disk (v = 0 embaixo/sul, convenção WebGL). */
export function scanToUv(scan: ScanAngles, sat: GeoSatellite = GOES_EAST): { u: number; v: number } {
  const span = 2 * sat.extentRad
  return {
    u: (scan.x + sat.extentRad) / span,
    v: (scan.y + sat.extentRad) / span,
  }
}
