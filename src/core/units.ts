// Formatação de números para o HUD, sempre em pt-BR.

const intFmt = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })
const oneDecFmt = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** Arredonda como o texto será exibido: 1 casa abaixo de 10, inteiro a partir de 10. */
function displayRound(value: number): number {
  return value < 10 ? Math.round(value * 10) / 10 : Math.round(value)
}

function formatDisplay(value: number): string {
  return value < 10 ? oneDecFmt.format(value) : intFmt.format(value)
}

/** Altitude em metros → texto do HUD ("35.786 km", "12,4 km", "850 m"). */
export function formatAltitude(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return '0 m'

  const roundedMeters = Math.round(meters)
  if (roundedMeters < 1_000) return `${intFmt.format(roundedMeters)} m`

  const km = meters / 1_000
  const kmOneDecimal = Math.round(km * 10) / 10
  if (kmOneDecimal < 100) return `${oneDecFmt.format(kmOneDecimal)} km`
  return `${intFmt.format(Math.round(km))} km`
}

/** GSD (metros por pixel) → texto do HUD ("1,0 km/px", "28 m/px", "4,3 cm/px"). */
export function formatGsd(metersPerPixel: number): string {
  if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return '0 cm/px'

  // `limit`: valor (já arredondado) a partir do qual o texto deve subir de unidade.
  const units: Array<{ suffix: string; factor: number; limit: number }> = [
    { suffix: 'cm/px', factor: 0.01, limit: 100 },
    { suffix: 'm/px', factor: 1, limit: 1_000 },
    { suffix: 'km/px', factor: 1_000, limit: Infinity },
  ]

  // Começa pela maior unidade em que o valor é >= 1 e sobe se o arredondamento atingir o limite.
  let index = metersPerPixel >= 1_000 ? 2 : metersPerPixel >= 1 ? 1 : 0
  for (;;) {
    const unit = units[index]!
    const value = displayRound(metersPerPixel / unit.factor)
    if (value >= unit.limit) {
      index += 1
      continue
    }
    return `${formatDisplay(value)} ${unit.suffix}`
  }
}
