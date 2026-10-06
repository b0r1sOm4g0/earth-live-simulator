import { describe, it, expect } from 'vitest'
import { logRamp, goesGroundOpacity, goesCloudOpacity, tiltDegAt } from '../../src/core/curves'

describe('logRamp', () => {
  it('0 no início, 1 no fim, 0,5 na média geométrica', () => {
    expect(logRamp(1_000, 1_000, 10)).toBe(0)
    expect(logRamp(10, 1_000, 10)).toBe(1)
    expect(logRamp(100, 1_000, 10)).toBeCloseTo(0.5, 6)
  })
  it('satura fora do intervalo', () => {
    expect(logRamp(5_000, 1_000, 10)).toBe(0)
    expect(logRamp(1, 1_000, 10)).toBe(1)
  })
  it('altitude inválida conta como "chegou ao chão"', () => {
    expect(logRamp(0, 1_000, 10)).toBe(1)
    expect(logRamp(-3, 1_000, 10)).toBe(1)
    expect(logRamp(Number.NaN, 1_000, 10)).toBe(1)
  })
  it('é monotônica (descer nunca diminui o valor)', () => {
    let prev = -1
    for (let alt = 2_000; alt >= 5; alt *= 0.9) {
      const v = logRamp(alt, 1_000, 10)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('opacidades do GOES (três atos)', () => {
  it('ato 1: tudo opaco na órbita', () => {
    expect(goesGroundOpacity(35_786_000)).toBe(1)
    expect(goesCloudOpacity(35_786_000)).toBe(1)
  })
  it('ato 2: chão some, nuvens ficam', () => {
    expect(goesGroundOpacity(500_000)).toBe(0)
    expect(goesCloudOpacity(500_000)).toBe(1)
  })
  it('ato 3 e abaixo: nuvens somem até 30 km', () => {
    expect(goesCloudOpacity(30_000)).toBe(0)
    expect(goesCloudOpacity(5_000)).toBe(0)
  })
})

describe('tiltDegAt', () => {
  it('nadir acima de 50 km', () => {
    expect(tiltDegAt(100_000)).toBe(0)
    expect(tiltDegAt(50_000)).toBe(0)
  })
  it('35° em 150 m ou abaixo', () => {
    expect(tiltDegAt(150)).toBe(35)
    expect(tiltDegAt(100)).toBe(35)
  })
  it('intermediário entre os extremos', () => {
    const t = tiltDegAt(3_000)
    expect(t).toBeGreaterThan(0)
    expect(t).toBeLessThan(35)
  })
})
