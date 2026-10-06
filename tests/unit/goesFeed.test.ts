import { describe, it, expect, vi } from 'vitest'
import {
  parseGoesTimestamp,
  latestFrameFile,
  pickResolution,
  frameAgeMinutes,
  frameStatus,
  fetchLatestFrame,
  GOES_FD_BASE,
  FALLBACK_FRAME_URL,
} from '../../src/data/goesFeed'

const LISTING = `
<a href="20262790340_GOES19-ABI-FD-GEOCOLOR-5424x5424.jpg">x</a>
<a href="20262790340_GOES19-ABI-FD-GEOCOLOR-1808x1808.jpg">x</a>
<a href="20262790350_GOES19-ABI-FD-GEOCOLOR-5424x5424.jpg">x</a>
<a href="20262790350_GOES19-ABI-FD-GEOCOLOR-678x678.jpg">x</a>
`

describe('parseGoesTimestamp', () => {
  it('converte ano + dia do ano + hora em UTC', () => {
    const d = parseGoesTimestamp('20262790340_GOES19-ABI-FD-GEOCOLOR-5424x5424.jpg')
    expect(d?.toISOString()).toBe('2026-10-06T03:40:00.000Z')
  })
  it('dia 1 é 1º de janeiro', () => {
    expect(parseGoesTimestamp('20260010000_x.jpg')?.toISOString()).toBe('2026-01-01T00:00:00.000Z')
  })
  it('nome inválido devolve null', () => {
    expect(parseGoesTimestamp('latest.jpg')).toBeNull()
    expect(parseGoesTimestamp('20269990000_x.jpg')).toBeNull()
  })
})

describe('latestFrameFile', () => {
  it('pega o mais recente da resolução pedida', () => {
    expect(latestFrameFile(LISTING, 5424)).toBe('20262790350_GOES19-ABI-FD-GEOCOLOR-5424x5424.jpg')
    expect(latestFrameFile(LISTING, 1808)).toBe('20262790340_GOES19-ABI-FD-GEOCOLOR-1808x1808.jpg')
  })
  it('null se a resolução não existe ou a listagem está vazia', () => {
    expect(latestFrameFile('<html></html>', 5424)).toBeNull()
    expect(latestFrameFile('', 1808)).toBeNull()
  })
})

describe('pickResolution', () => {
  it('5424 em GPUs com textura >= 8192', () => {
    expect(pickResolution(16384)).toBe(5424)
    expect(pickResolution(8192)).toBe(5424)
  })
  it('1808 em GPUs menores', () => {
    expect(pickResolution(4096)).toBe(1808)
  })
})

describe('idade e status do frame', () => {
  const frame = new Date('2026-10-06T03:40:00Z')
  it('idade em minutos', () => {
    expect(frameAgeMinutes(frame, new Date('2026-10-06T03:47:00Z'))).toBe(7)
  })
  it('frame "no futuro" (relógio atrasado) tem idade 0', () => {
    expect(frameAgeMinutes(frame, new Date('2026-10-06T03:30:00Z'))).toBe(0)
  })
  it('fresh até 60 min, stale depois', () => {
    expect(frameStatus(frame, new Date('2026-10-06T04:40:00Z'))).toBe('fresh')
    expect(frameStatus(frame, new Date('2026-10-06T04:41:00Z'))).toBe('stale')
  })
  it('sem horário conhecido é stale', () => {
    expect(frameStatus(null, new Date())).toBe('stale')
  })
})

describe('fetchLatestFrame', () => {
  it('monta a URL do frame mais recente', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(LISTING, { status: 200 }))
    const frame = await fetchLatestFrame(5424, fetchFn as unknown as typeof fetch)
    expect(fetchFn).toHaveBeenCalledWith(`${GOES_FD_BASE}/`)
    expect(frame.url).toBe(`${GOES_FD_BASE}/20262790350_GOES19-ABI-FD-GEOCOLOR-5424x5424.jpg`)
    expect(frame.time?.toISOString()).toBe('2026-10-06T03:50:00.000Z')
    expect(frame.isFallback).toBe(false)
  })
  it('falha de rede devolve o fallback', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('network'))
    const frame = await fetchLatestFrame(5424, fetchFn as unknown as typeof fetch)
    expect(frame).toEqual({ url: FALLBACK_FRAME_URL, time: null, isFallback: true })
  })
  it('HTTP de erro devolve o fallback', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('x', { status: 503 }))
    const frame = await fetchLatestFrame(5424, fetchFn as unknown as typeof fetch)
    expect(frame.isFallback).toBe(true)
  })
  it('listagem sem a resolução devolve o fallback', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html></html>', { status: 200 }))
    const frame = await fetchLatestFrame(1808, fetchFn as unknown as typeof fetch)
    expect(frame.isFallback).toBe(true)
  })
})
