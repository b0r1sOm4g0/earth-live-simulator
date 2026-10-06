import { describe, it, expect } from 'vitest'
import { latLonToScan, scanToUv, GOES_EAST } from '../../src/layers/goesProjection'

describe('latLonToScan (fixed grid GOES-R)', () => {
  it('bate com o exemplo do GOES-R PUG', () => {
    const s = latLonToScan(33.846162, -84.690932)!
    expect(s.x).toBeCloseTo(-0.024052, 5)
    expect(s.y).toBeCloseTo(0.09534, 5)
  })
  it('ponto subsatélite é a origem', () => {
    const s = latLonToScan(0, -75)!
    expect(s.x).toBeCloseTo(0, 9)
    expect(s.y).toBeCloseTo(0, 9)
  })
  it('Porto Alegre fica a sudeste do centro', () => {
    const s = latLonToScan(-30.03, -51.23)!
    expect(s.x).toBeCloseTo(0.059743, 5)
    expect(s.y).toBeCloseTo(-0.08531, 5)
  })
  it('lado oposto da Terra não é visível', () => {
    expect(latLonToScan(0, 105)).toBeNull()
    expect(latLonToScan(10, 120)).toBeNull()
  })
  it('polo norte não é visível (além do limbo)', () => {
    expect(latLonToScan(89, -75)).toBeNull()
  })
})

describe('scanToUv', () => {
  it('origem vai para o centro da imagem', () => {
    expect(scanToUv({ x: 0, y: 0 })).toEqual({ u: 0.5, v: 0.5 })
  })
  it('extremos da varredura vão para as bordas', () => {
    const e = GOES_EAST.extentRad
    expect(scanToUv({ x: -e, y: -e })).toEqual({ u: 0, v: 0 })
    expect(scanToUv({ x: e, y: e })).toEqual({ u: 1, v: 1 })
  })
  it('Porto Alegre cai no quadrante sudeste (u > 0,5; v < 0,5)', () => {
    const uv = scanToUv(latLonToScan(-30.03, -51.23)!)
    expect(uv.u).toBeCloseTo(0.6967, 3)
    expect(uv.v).toBeCloseTo(0.2191, 3)
  })
})
