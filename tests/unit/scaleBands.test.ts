import { describe, it, expect } from 'vitest'
import { bandAt, gsdAt, SCALE_BANDS, MAX_ALTITUDE } from '../../src/core/scaleBands'

describe('bandAt', () => {
  it('escolhe a faixa certa no meio de cada intervalo', () => {
    expect(bandAt(35_786_000).id).toBe('GEO')
    expect(bandAt(400_000).id).toBe('LEO')
    expect(bandAt(18_000).id).toBe('HALE')
    expect(bandAt(1_000).id).toBe('DRONE')
    expect(bandAt(150).id).toBe('HOVER')
  })
  it('a fronteira pertence à faixa de cima (mínimo inclusivo)', () => {
    expect(bandAt(1_000_000).id).toBe('GEO')
    expect(bandAt(50_000).id).toBe('LEO')
    expect(bandAt(5_000).id).toBe('HALE')
    expect(bandAt(200).id).toBe('DRONE')
  })
  it('satura fora do intervalo', () => {
    expect(bandAt(MAX_ALTITUDE * 2).id).toBe('GEO')
    expect(bandAt(0).id).toBe('HOVER')
    expect(bandAt(-50).id).toBe('HOVER')
    expect(bandAt(Number.NaN).id).toBe('HOVER')
  })
  it('as faixas cobrem tudo, sem buracos', () => {
    for (let i = 1; i < SCALE_BANDS.length; i++) {
      expect(SCALE_BANDS[i]!.maxAltitude).toBe(SCALE_BANDS[i - 1]!.minAltitude)
    }
  })
})

describe('gsdAt', () => {
  it('~1 km/px na órbita GEO', () => {
    expect(gsdAt(36_000_000)).toBeCloseTo(1_008, 0)
  })
  it('~4,3 cm/px a 200 m com o Matrice 4TD', () => {
    expect(gsdAt(200)).toBeCloseTo(0.0432, 4)
  })
  it('troca de sensor em 50 km: LEO em 50 km, Global Hawk logo abaixo', () => {
    expect(gsdAt(50_000)).toBeCloseTo(0.635, 3)
    expect(gsdAt(49_999)).toBeCloseTo(3.0, 1)
  })
  it('nunca devolve NaN ou negativo', () => {
    expect(gsdAt(-10)).toBe(0)
    expect(gsdAt(Number.NaN)).toBe(0)
    expect(gsdAt(MAX_ALTITUDE * 3)).toBeCloseTo(1_008, 0)
  })
})
