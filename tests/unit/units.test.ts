import { describe, it, expect } from 'vitest'
import { formatAltitude, formatGsd } from '../../src/core/units'

describe('formatAltitude', () => {
  it('órbita GEO em km inteiros com ponto de milhar', () => {
    expect(formatAltitude(35_786_000)).toBe('35.786 km')
  })
  it('entre 1 e 100 km usa uma casa decimal com vírgula', () => {
    expect(formatAltitude(12_430)).toBe('12,4 km')
    expect(formatAltitude(1_000)).toBe('1,0 km')
  })
  it('abaixo de 1 km usa metros inteiros', () => {
    expect(formatAltitude(850.4)).toBe('850 m')
    expect(formatAltitude(100)).toBe('100 m')
  })
  it('sobe de unidade quando o arredondamento cruza a fronteira', () => {
    expect(formatAltitude(999.6)).toBe('1,0 km')
    expect(formatAltitude(99_960)).toBe('100 km')
  })
  it('valores inválidos viram 0 m', () => {
    expect(formatAltitude(-5)).toBe('0 m')
    expect(formatAltitude(Number.NaN)).toBe('0 m')
  })
})

describe('formatGsd', () => {
  it('km/px na órbita', () => {
    expect(formatGsd(1_008)).toBe('1,0 km/px')
  })
  it('m/px com uma casa abaixo de 10 e inteiro acima', () => {
    expect(formatGsd(3.0)).toBe('3,0 m/px')
    expect(formatGsd(28.2)).toBe('28 m/px')
  })
  it('cm/px abaixo de 1 m', () => {
    expect(formatGsd(0.0432)).toBe('4,3 cm/px')
    expect(formatGsd(0.3)).toBe('30 cm/px')
  })
  it('sobe de unidade quando o arredondamento cruza a fronteira', () => {
    expect(formatGsd(0.9996)).toBe('1,0 m/px')
    expect(formatGsd(999.7)).toBe('1,0 km/px')
  })
})
