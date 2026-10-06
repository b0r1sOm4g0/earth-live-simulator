# Earth Live Simulator — Plano 1: Fundação + Spike (Fase 0)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a base do projeto (módulos puros testados de faixas de escala, curvas, unidades, projeção GOES e feed GOES) e executar o spike técnico que decide se seguimos com Three.js + 3d-tiles-renderer + Takram ou recuamos para CesiumJS.

**Architecture:** Módulos de matemática/dados puros em `src/core`, `src/layers/goesProjection.ts` e `src/data`, sem dependência de Three.js, testados com Vitest. O spike é uma página separada (`spike.html` + `spike/`) que importa esses módulos e monta globo (Google 3D Tiles + `GlobeControls`), casca GOES com shader e atmosfera Takram, tudo em coordenadas ECEF. O código em `spike/` é descartável. Os módulos de `src/` permanecem.

**Tech Stack:** Node 24, TypeScript 5.9, Vite 8, Vitest 5, three 0.186, 3d-tiles-renderer 0.5.3, @takram/three-atmosphere 0.19.1, postprocessing 6.39, lil-gui (só no spike).

**Spec:** `docs/superpowers/specs/2026-10-06-earth-live-simulator-design.md`

**Escopo deste plano:** Fase 0 da spec (§11) e os módulos puros de que ela precisa. As Fases 1–5 (câmera definitiva, camadas definitivas, HUD React, zona de Porto Alegre) terão um **Plano 2**, escrito depois do resultado do spike, porque os detalhes dependem do que o spike validar.

## Global Constraints

- Altitude máxima: **36.000 km** (`36_000_000` m). Mínima: **100 m** AGL.
- Faixas (§4.4): GEO 36.000→1.000 km (GOES-19 ABI · GEOCOLOR · IFOV 28 µrad); LEO 1.000→50 km (Satélite LEO classe Sentinel-2 · RGB · 12,7 µrad); HALE 50→5 km (RQ-4 Global Hawk · RGB · 60 µrad); DRONE 5 km→200 m (DJI Matrice 4TD · RGB · 216 µrad); HOVER < 200 m (DJI Matrice 4TD · RGB · 216 µrad).
- `GSD = altitude × IFOV`.
- Atos do GOES (§5.2): chão do GOES 1→0 entre 5.000 e 500 km; nuvens 1→0 entre 500 e 30 km; abaixo de 30 km camada desligada.
- Tilt: 0° acima de 50 km → 35° em 150 m (interpolação em log da altitude).
- GOES: Full Disk GEOCOLOR, `https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/`, 5424×5424 (fallback 1808×1808 se `MAX_TEXTURE_SIZE < 8192`); casca a **12 km**; projeção fixed grid GOES-R, `lon0 = −75,0°`, extensão ±0,151872 rad; frame "velho" (âmbar) quando > 1 h.
- Key do Google em `.env.local` como `VITE_GOOGLE_MAP_TILES_KEY`; nunca versionada.
- Textos visíveis ao usuário em português (pt-BR); números com formatação pt-BR (vírgula decimal, ponto de milhar).
- Comentários de código em português; identificadores em inglês.

## Review Focus

1. **Altitude/GSD na fronteira de unidade** (ex.: 999,6 m; 99.960 m; 0,9996 m/px): o texto não pode mostrar "1000 m" nem "100,0 km" nem "100 cm/px"; deve subir para a unidade seguinte. → testes na Task 2.
2. **Altitude fora do intervalo** (acima de 36.000 km, zero ou negativa vinda de raycast): `bandAt`, `gsdAt` e as curvas devem saturar sem `undefined`/`NaN`. → testes nas Tasks 3 e 4.
3. **Pontos fora do disco do GOES** (lado oposto da Terra, latitudes extremas além do limbo): projeção retorna `null`; o shader descarta em vez de esticar a textura. → testes na Task 5 + verificação visual na Task 8.
4. **Listagem da NOAA sem o arquivo da resolução pedida, HTML vazio ou falha de rede:** o feed devolve o frame de fallback com status `stale`, sem lançar erro até a camada. → testes na Task 6.
5. **Relógio do usuário adiantado/atrasado em relação ao frame** (frame "no futuro"): idade nunca negativa; status `fresh` até 1 h, `stale` depois. → testes na Task 6.

---

## Antes de começar (ação humana)

O spike (Tasks 7–10) precisa de uma key do Google Map Tiles API. As Tasks 1–6 não precisam.

1. Em https://console.cloud.google.com crie um projeto (ex.: `earth-live-sim`).
2. Ative o faturamento no projeto (exigido pelo Google mesmo dentro da cota gratuita).
3. Em "APIs e serviços → Biblioteca", ative **Map Tiles API**.
4. Em "Credenciais", crie uma **chave de API** e restrinja-a à Map Tiles API e ao referenciador `http://localhost:5173/*`.
5. Em "Faturamento → Orçamentos e alertas", crie um orçamento baixo (ex.: US$ 5) com alerta por e-mail.
6. Guarde a key; ela vai para `.env.local` na Task 7.

---

### Task 1: Scaffold do projeto

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.env.example`, `index.html`, `src/main.ts`, `tests/unit/smoke.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: comandos `npm test` (Vitest, uma execução), `npm run dev` (Vite em `http://localhost:5173`), `npm run typecheck`. Vite com duas páginas: `index.html` e `spike.html` (a segunda é criada na Task 7).

- [ ] **Step 1: Criar `package.json`**

Diretório de trabalho de todo o plano: a raiz do repositório.

```json
{
  "name": "earth-live-simulator",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Instalar dependências**

Run:
```bash
npm i three@0.186 3d-tiles-renderer@0.5.3 @takram/three-atmosphere@0.19.1 postprocessing@6.39
npm i -D typescript@5.9 vite@8 vitest@5 @types/three@0.186 lil-gui@0.20
```
Expected: ambos terminam com `found 0 vulnerabilities` (ou só avisos), sem `ERR!`. Observação: o npm instala `@react-three/fiber` como peer do Takram; isso é esperado.

- [ ] **Step 3: Criar `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["vite/client"],
    "noEmit": true
  },
  "include": ["src", "spike", "tests"]
}
```

- [ ] **Step 4: Criar `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

// Duas páginas: o app (index.html) e o spike descartável (spike.html).
// defineConfig vem de 'vitest/config' para tipar também a chave `test`.
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        spike: 'spike.html',
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
})
```

Observação: `build` vai falhar até `spike.html` existir (Task 7). `dev` e `test` funcionam desde já.

- [ ] **Step 5: Criar `.gitignore` e `.env.example`**

`.gitignore`:
```
node_modules
dist
.env.local
*.log
```

`.env.example`:
```
# Copie para .env.local e preencha. Nunca faça commit de .env.local.
VITE_GOOGLE_MAP_TILES_KEY=
```

- [ ] **Step 6: Criar `index.html` e `src/main.ts`**

`index.html`:
```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Earth Live Simulator</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`src/main.ts`:
```ts
// Ponto de entrada do app definitivo. Fica vazio até o Plano 2;
// por enquanto, o trabalho visual acontece em spike.html.
const app = document.querySelector<HTMLDivElement>('#app')
if (app) app.textContent = 'Earth Live Simulator — em construção. Abra /spike.html'
```

- [ ] **Step 7: Teste de fumaça**

`tests/unit/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'

describe('ambiente de testes', () => {
  it('roda o Vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `npm test`
Expected: `1 passed`.

Run: `npm run typecheck`
Expected: sem erros.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts .gitignore .env.example index.html src/main.ts tests/unit/smoke.test.ts
git commit -m "chore: scaffold Vite + TypeScript + Vitest"
```

---

### Task 2: Formatação de unidades (`src/core/units.ts`)

**Files:**
- Create: `src/core/units.ts`
- Test: `tests/unit/units.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `formatAltitude(meters: number): string` — ex.: `"35.786 km"`, `"12,4 km"`, `"850 m"`.
  - `formatGsd(metersPerPixel: number): string` — ex.: `"1,0 km/px"`, `"28 m/px"`, `"3,0 m/px"`, `"4,3 cm/px"`.

Regras:
- Altitude: ≥ 100 km → km inteiros com ponto de milhar; 1 km a < 100 km → km com 1 casa; < 1 km → metros inteiros. A unidade é escolhida **depois** do arredondamento (999,6 m vira `"1,0 km"`; 99.960 m vira `"100 km"`). Negativos e `NaN` viram `"0 m"`.
- GSD: escolhe km/px (≥ 1000 m), m/px (≥ 1 m) ou cm/px; dentro da unidade, valores < 10 têm 1 casa e ≥ 10 são inteiros; se o arredondamento atingir 1000 da unidade (cm→m, m→km), sobe de unidade.

- [ ] **Step 1: Escrever os testes**

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/units.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/core/units"`.

- [ ] **Step 3: Implementar**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/units.test.ts`
Expected: PASS (9 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/units.ts tests/unit/units.test.ts
git commit -m "feat(core): formatação pt-BR de altitude e GSD"
```

---

### Task 3: Faixas de escala e GSD (`src/core/scaleBands.ts`)

**Files:**
- Create: `src/core/scaleBands.ts`
- Test: `tests/unit/scaleBands.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type BandId = 'GEO' | 'LEO' | 'HALE' | 'DRONE' | 'HOVER'`
  - `interface ScaleBand { id: BandId; minAltitude: number; maxAltitude: number; platform: string; sensor: string; ifovRad: number }`
  - `const MAX_ALTITUDE = 36_000_000`, `const MIN_ALTITUDE = 100`
  - `const SCALE_BANDS: readonly ScaleBand[]` (ordem: da maior para a menor altitude)
  - `bandAt(altitude: number): ScaleBand` — intervalo `[minAltitude, maxAltitude)`; acima de tudo → GEO; abaixo/inválido → HOVER.
  - `gsdAt(altitude: number): number` — `altitude × ifovRad` da faixa, com altitude saturada em `[0, MAX_ALTITUDE]`.

- [ ] **Step 1: Escrever os testes**

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/scaleBands.test.ts`
Expected: FAIL — import não resolvido.

- [ ] **Step 3: Implementar**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/scaleBands.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/scaleBands.ts tests/unit/scaleBands.test.ts
git commit -m "feat(core): faixas de escala, plataformas e GSD simulado"
```

---

### Task 4: Curvas por altitude (`src/core/curves.ts`)

**Files:**
- Create: `src/core/curves.ts`
- Test: `tests/unit/curves.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `logRamp(altitude: number, from: number, to: number): number` — 0 em `altitude ≥ from`, 1 em `altitude ≤ to` (`from > to`), smoothstep em espaço logarítmico; inválido (≤ 0, NaN) → 1.
  - `goesGroundOpacity(altitude: number): number` — 1 acima de 5.000 km, 0 abaixo de 500 km.
  - `goesCloudOpacity(altitude: number): number` — 1 acima de 500 km, 0 abaixo de 30 km.
  - `tiltDegAt(altitude: number): number` — 0 acima de 50 km, 35 em 150 m ou menos.
  - Constantes exportadas: `GOES_GROUND_FADE = { from: 5_000_000, to: 500_000 }`, `GOES_CLOUD_FADE = { from: 500_000, to: 30_000 }`, `TILT_RAMP = { from: 50_000, to: 150, maxDeg: 35 }`.

- [ ] **Step 1: Escrever os testes**

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/curves.test.ts`
Expected: FAIL — import não resolvido.

- [ ] **Step 3: Implementar**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/curves.test.ts`
Expected: PASS (10 testes).

- [ ] **Step 5: Commit**

```bash
git add src/core/curves.ts tests/unit/curves.test.ts
git commit -m "feat(core): curvas logarítmicas de opacidade do GOES e tilt"
```

---

### Task 5: Projeção geoestacionária (`src/layers/goesProjection.ts`)

**Files:**
- Create: `src/layers/goesProjection.ts`
- Test: `tests/unit/goesProjection.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `interface GeoSatellite { lon0Deg: number; perspectiveHeight: number; rEq: number; rPol: number; extentRad: number }`
  - `const GOES_EAST: GeoSatellite` = `{ lon0Deg: -75.0, perspectiveHeight: 35_786_023, rEq: 6_378_137, rPol: 6_356_752.31414, extentRad: 0.151872 }`
  - `interface ScanAngles { x: number; y: number }` (radianos; x leste-oeste, y norte-sul, y positivo = norte)
  - `latLonToScan(latDeg: number, lonDeg: number, sat?: GeoSatellite): ScanAngles | null` — `null` se o ponto não é visível pelo satélite.
  - `scanToUv(scan: ScanAngles, sat?: GeoSatellite): { u: number; v: number }` — `u` 0→1 de oeste para leste; `v` 0→1 **de baixo (sul) para cima (norte)**, que é a convenção de UV do WebGL com `flipY = true`.
  - Estas fórmulas são as mesmas que o shader GLSL da Task 8 usa.

Referência: GOES-R Product User Guide (PUG), Vol. 3, §4.2.8 — exemplo `lat 33,846162°, lon −84,690932°` → `x = −0,024052 rad`, `y = 0,095340 rad` com `lon0 = −75°`.

- [ ] **Step 1: Escrever os testes**

```ts
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
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run tests/unit/goesProjection.test.ts`
Expected: FAIL — import não resolvido.

- [ ] **Step 3: Implementar**

```ts
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
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run tests/unit/goesProjection.test.ts`
Expected: PASS (8 testes).

- [ ] **Step 5: Commit**

```bash
git add src/layers/goesProjection.ts tests/unit/goesProjection.test.ts
git commit -m "feat(goes): projeção fixed grid GOES-R validada contra o PUG"
```

---

### Task 6: Feed GOES (`src/data/goesFeed.ts`)

**Files:**
- Create: `src/data/goesFeed.ts`, `public/fallback/goes-fd-1808.jpg`
- Test: `tests/unit/goesFeed.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `const GOES_FD_BASE = 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR'`
  - `const FALLBACK_FRAME_URL = '/fallback/goes-fd-1808.jpg'`
  - `type GoesResolution = 1808 | 5424`
  - `interface GoesFrame { url: string; time: Date | null; isFallback: boolean }`
  - `type FrameStatus = 'fresh' | 'stale'`
  - `parseGoesTimestamp(filename: string): Date | null` — prefixo `YYYYDDDHHMM` (ano, dia do ano, hora, minuto, UTC).
  - `latestFrameFile(listingHtml: string, res: GoesResolution): string | null`
  - `pickResolution(maxTextureSize: number): GoesResolution` — `≥ 8192` → 5424, senão 1808.
  - `frameAgeMinutes(frameTime: Date, now: Date): number` — nunca negativo.
  - `frameStatus(frameTime: Date | null, now: Date): FrameStatus` — `stale` se `null` ou idade > 60 min.
  - `fetchLatestFrame(res: GoesResolution, fetchFn?: typeof fetch): Promise<GoesFrame>` — nunca rejeita; em qualquer falha devolve `{ url: FALLBACK_FRAME_URL, time: null, isFallback: true }`.

- [ ] **Step 1: Baixar o frame de fallback**

Run:
```bash
mkdir -p public/fallback
curl -sf https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/1808x1808.jpg -o public/fallback/goes-fd-1808.jpg
file public/fallback/goes-fd-1808.jpg
```
Expected: `JPEG image data ... 1808x1808`.

- [ ] **Step 2: Escrever os testes**

```ts
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
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx vitest run tests/unit/goesFeed.test.ts`
Expected: FAIL — import não resolvido.

- [ ] **Step 4: Implementar**

```ts
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
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx vitest run tests/unit/goesFeed.test.ts`
Expected: PASS (15 testes).

- [ ] **Step 6: Rodar a suíte inteira e o typecheck**

Run: `npm test && npm run typecheck`
Expected: todos os testes passam; typecheck sem erros.

- [ ] **Step 7: Commit**

```bash
git add src/data/goesFeed.ts tests/unit/goesFeed.test.ts public/fallback/goes-fd-1808.jpg
git commit -m "feat(goes): feed do Full Disk GEOCOLOR com fallback embutido"
```

---

### Task 7: Spike — globo com Google 3D Tiles, controles e telemetria de debug

> Código do spike é **descartável** (`spike/`). Não escreva testes unitários para ele; a verificação é visual e medida, registrada na Task 10.

**Files:**
- Create: `spike.html`, `spike/main.ts`, `spike/globe.ts`, `spike/debugOverlay.ts`, `.env.local` (não versionado)

**Interfaces:**
- Consumes: `bandAt`, `gsdAt` (Task 3); `formatAltitude`, `formatGsd` (Task 2); `tiltDegAt` não é usado aqui.
- Produces (usado pelas Tasks 8 e 9):
  - `createGlobe(renderer: WebGLRenderer, camera: PerspectiveCamera, scene: Scene, apiKey: string): { tiles: TilesRenderer; controls: GlobeControls; cameraAltitude(): number; update(): void }`
  - `createDebugOverlay(): { set(lines: Record<string, string>): void }`
  - Cena em **ECEF** (metros, Z = eixo polar). `tiles.group` sem rotação.

- [ ] **Step 1: Configurar a key**

Run:
```bash
cp .env.example .env.local
```
Edite `.env.local` e coloque a key criada em "Antes de começar": `VITE_GOOGLE_MAP_TILES_KEY=AIza...`

Run: `git status --short`
Expected: `.env.local` **não** aparece (está no `.gitignore`).

- [ ] **Step 2: Criar `spike.html`**

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>ELS — Spike</title>
    <style>
      html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
      canvas { display: block; }
      #debug {
        position: fixed; top: 12px; left: 12px; padding: 8px 10px;
        font: 12px/1.5 ui-monospace, monospace; color: #9f9; background: rgba(0,0,0,.6);
        white-space: pre; pointer-events: none;
      }
    </style>
  </head>
  <body>
    <pre id="debug"></pre>
    <script type="module" src="/spike/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 3: Criar `spike/debugOverlay.ts`**

```ts
// Painel de texto no canto da tela para ler números durante o spike.
export function createDebugOverlay() {
  const el = document.getElementById('debug')!
  return {
    set(lines: Record<string, string>) {
      el.textContent = Object.entries(lines)
        .map(([k, v]) => `${k.padEnd(10)} ${v}`)
        .join('\n')
    },
  }
}
```

- [ ] **Step 4: Criar `spike/globe.ts`**

```ts
// Globo: Google Photorealistic 3D Tiles + GlobeControls, em coordenadas ECEF.
import { MathUtils, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { TilesRenderer, GlobeControls } from '3d-tiles-renderer'
import { GoogleCloudAuthPlugin, TilesFadePlugin } from '3d-tiles-renderer/plugins'
import { MAX_ALTITUDE } from '../src/core/scaleBands'

// Porto Alegre (Centro Histórico) — ponto inicial da câmera.
const START = { latDeg: -30.03, lonDeg: -51.23, altitude: 35_786_000 }

export function createGlobe(renderer: WebGLRenderer, camera: PerspectiveCamera, scene: Scene, apiKey: string) {
  const tiles = new TilesRenderer()
  tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: apiKey, autoRefreshToken: true }))
  tiles.registerPlugin(new TilesFadePlugin())
  tiles.setCamera(camera)
  tiles.setResolutionFromRenderer(camera, renderer)
  scene.add(tiles.group)

  // Câmera começa em órbita GEO sobre Porto Alegre, olhando para o centro da Terra.
  tiles.ellipsoid.getCartographicToPosition(
    START.latDeg * MathUtils.DEG2RAD,
    START.lonDeg * MathUtils.DEG2RAD,
    START.altitude,
    camera.position,
  )
  camera.up.set(0, 0, 1)
  camera.lookAt(0, 0, 0)

  const controls = new GlobeControls(scene, camera, renderer.domElement)
  controls.setEllipsoid(tiles.ellipsoid, tiles.group)
  controls.enableDamping = true
  controls.maxDistance = MAX_ALTITUDE + tiles.ellipsoid.radius.x
  controls.minDistance = 100

  const carto = { lat: 0, lon: 0, height: 0 }
  const tmp = new Vector3()

  return {
    tiles,
    controls,
    /** Altura da câmera acima do elipsoide (m). */
    cameraAltitude(): number {
      tmp.copy(camera.position)
      tiles.ellipsoid.getPositionToCartographic(tmp, carto)
      return carto.height
    },
    update() {
      controls.update()
      camera.updateMatrixWorld()
      tiles.setResolutionFromRenderer(camera, renderer)
      tiles.update()
    },
  }
}
```

- [ ] **Step 5: Criar `spike/main.ts`**

```ts
// Spike da Fase 0: valida a pilha Three.js + 3d-tiles-renderer (+ GOES + Takram nas Tasks 8–9).
import { PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import { createGlobe } from './globe'
import { createDebugOverlay } from './debugOverlay'
import { bandAt, gsdAt } from '../src/core/scaleBands'
import { formatAltitude, formatGsd } from '../src/core/units'

const apiKey = import.meta.env.VITE_GOOGLE_MAP_TILES_KEY as string | undefined
if (!apiKey) {
  document.body.innerHTML =
    '<p style="color:#fff;font:16px sans-serif;padding:24px">Falta VITE_GOOGLE_MAP_TILES_KEY em .env.local</p>'
  throw new Error('VITE_GOOGLE_MAP_TILES_KEY ausente')
}

// Depth buffer logarítmico: necessário para ir de 36.000 km a 150 m sem z-fighting.
const renderer = new WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true })
renderer.setPixelRatio(window.devicePixelRatio)
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

const scene = new Scene()
const camera = new PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1e9)

const globe = createGlobe(renderer, camera, scene, apiKey)
const debug = createDebugOverlay()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
})

// Medidor de FPS simples (média móvel de 1 s).
let frames = 0
let fps = 0
let lastFpsTime = performance.now()

renderer.setAnimationLoop(() => {
  globe.update()
  renderer.render(scene, camera)

  frames++
  const now = performance.now()
  if (now - lastFpsTime >= 1000) {
    fps = (frames * 1000) / (now - lastFpsTime)
    frames = 0
    lastFpsTime = now
  }

  const alt = globe.cameraAltitude()
  const band = bandAt(alt)
  debug.set({
    altitude: formatAltitude(alt),
    faixa: band.id,
    sensor: `${band.platform} · ${band.sensor}`,
    gsd: formatGsd(gsdAt(alt)),
    fps: fps.toFixed(0),
  })
})
```

- [ ] **Step 6: Rodar e verificar visualmente**

Run: `npm run dev` e abra `http://localhost:5173/spike.html`.

Expected:
- O globo aparece inteiro, com a América do Sul centralizada; o painel mostra `altitude 35.786 km`, `faixa GEO`.
- Scroll sobre Porto Alegre aproxima mirando no cursor; arrastar move o globo.
- Ao descer até ~150 m sobre o Centro Histórico, aparecem prédios 3D.
- A telemetria muda de faixa: GEO → LEO → HALE → DRONE → HOVER.
- Nenhum erro no console. (Se aparecer 403 da `tile.googleapis.com`, a key, a API ou o faturamento não estão ativos.)

Anote para a Task 10: (a) fps mínimo observado durante uma descida contínua; (b) se há tremedeira/z-fighting a ~150 m; (c) como a descida "pesa" (é contínua? rápida demais perto do chão?).

- [ ] **Step 7: Commit**

```bash
git add spike.html spike/main.ts spike/globe.ts spike/debugOverlay.ts
git commit -m "spike: globo com Google 3D Tiles, GlobeControls e telemetria"
```

---

### Task 8: Spike — casca GOES com reprojeção e máscara de nuvem

**Files:**
- Create: `spike/goesShell.ts`
- Modify: `spike/main.ts`

**Interfaces:**
- Consumes: `GOES_EAST` (Task 5); `fetchLatestFrame`, `pickResolution`, `frameAgeMinutes`, `frameStatus` (Task 6); `goesGroundOpacity`, `goesCloudOpacity` (Task 4).
- Produces: `createGoesShell(scene: Scene): { mesh: Mesh; material: ShaderMaterial; setTexture(tex: Texture): void; setAltitude(altitude: number): void }`. Uniforms ajustáveis: `cloudBrightness` (padrão 0,55), `cloudMaxSaturation` (padrão 0,18).

- [ ] **Step 1: Criar `spike/goesShell.ts`**

```ts
// Casca esférica a 12 km de altitude com a imagem GOES-19 Full Disk reprojetada.
// O fragment shader replica src/layers/goesProjection.ts (fixed grid GOES-R).
import { FrontSide, Mesh, ShaderMaterial, SphereGeometry, Texture, Scene } from 'three'
import { GOES_EAST } from '../src/layers/goesProjection'
import { goesCloudOpacity, goesGroundOpacity } from '../src/core/curves'

const SHELL_ALTITUDE = 12_000

const vertexShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec3 vEcef;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vEcef = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
    #include <logdepthbuf_vertex>
  }
`

const fragmentShader = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_fragment>
  uniform sampler2D goesMap;
  uniform float groundOpacity;
  uniform float cloudOpacity;
  uniform float cloudBrightness;
  uniform float cloudMaxSaturation;
  uniform float lon0;
  uniform float rEq;
  uniform float rPol;
  uniform float satHeight;
  uniform float extent;
  varying vec3 vEcef;

  void main() {
    #include <logdepthbuf_fragment>
    float e2 = (rEq * rEq - rPol * rPol) / (rEq * rEq);
    float H = satHeight + rEq;

    // ECEF da casca -> latitude geodésica aproximada e longitude.
    float p = length(vEcef.xy);
    float lat = atan(vEcef.z, p * (1.0 - e2));
    float lon = atan(vEcef.y, vEcef.x);

    // Mesmas fórmulas de latLonToScan().
    float latC = atan((rPol * rPol) / (rEq * rEq) * tan(lat));
    float rc = rPol / sqrt(1.0 - e2 * cos(latC) * cos(latC));
    float sx = H - rc * cos(latC) * cos(lon - lon0);
    float sy = -rc * cos(latC) * sin(lon - lon0);
    float sz = rc * sin(latC);
    if (H * (H - sx) < sy * sy + (rEq * rEq) / (rPol * rPol) * sz * sz) discard; // atrás do limbo

    float x = asin(-sy / length(vec3(sx, sy, sz)));
    float y = atan(sz / sx);
    vec2 uv = vec2((x + extent) / (2.0 * extent), (y + extent) / (2.0 * extent));
    if (uv.y < 0.03) discard; // logo e legenda gravados no rodapé da imagem

    vec3 c = texture2D(goesMap, uv).rgb;
    float bright = max(c.r, max(c.g, c.b));
    float sat = bright - min(c.r, min(c.g, c.b));
    // Máscara de nuvem aproximada: claro e pouco saturado.
    float cloud = smoothstep(cloudBrightness, cloudBrightness + 0.15, bright)
                * (1.0 - smoothstep(cloudMaxSaturation, cloudMaxSaturation + 0.1, sat));

    float alpha = max(groundOpacity, cloud * cloudOpacity);
    if (alpha <= 0.001) discard;
    gl_FragColor = vec4(c, alpha);
    #include <colorspace_fragment>
  }
`

export function createGoesShell(scene: Scene) {
  // SphereGeometry tem o polo no eixo Y; em ECEF o polo é o eixo Z.
  const geometry = new SphereGeometry(1, 512, 256)
  geometry.rotateX(Math.PI / 2)

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    side: FrontSide,
    uniforms: {
      goesMap: { value: null },
      groundOpacity: { value: 1 },
      cloudOpacity: { value: 1 },
      cloudBrightness: { value: 0.55 },
      cloudMaxSaturation: { value: 0.18 },
      lon0: { value: (GOES_EAST.lon0Deg * Math.PI) / 180 },
      rEq: { value: GOES_EAST.rEq },
      rPol: { value: GOES_EAST.rPol },
      satHeight: { value: GOES_EAST.perspectiveHeight },
      extent: { value: GOES_EAST.extentRad },
    },
  })

  const mesh = new Mesh(geometry, material)
  mesh.scale.set(GOES_EAST.rEq + SHELL_ALTITUDE, GOES_EAST.rEq + SHELL_ALTITUDE, GOES_EAST.rPol + SHELL_ALTITUDE)
  mesh.renderOrder = 1
  mesh.visible = false // fica visível quando a primeira textura chegar
  scene.add(mesh)

  return {
    mesh,
    material,
    setTexture(tex: Texture) {
      material.uniforms.goesMap!.value = tex
      mesh.visible = true
    },
    setAltitude(altitude: number) {
      const ground = goesGroundOpacity(altitude)
      const cloud = goesCloudOpacity(altitude)
      material.uniforms.groundOpacity!.value = ground
      material.uniforms.cloudOpacity!.value = cloud
      mesh.visible = material.uniforms.goesMap!.value !== null && (ground > 0 || cloud > 0)
    },
  }
}
```

- [ ] **Step 2: Integrar em `spike/main.ts`**

Adicione aos imports:
```ts
import { SRGBColorSpace, TextureLoader } from 'three'
import GUI from 'lil-gui'
import { createGoesShell } from './goesShell'
import { fetchLatestFrame, pickResolution, frameAgeMinutes, frameStatus, type GoesFrame } from '../src/data/goesFeed'
```

Depois de `const debug = createDebugOverlay()`, adicione:
```ts
// Camada GOES: busca o frame mais recente e atualiza a cada 10 minutos.
const goes = createGoesShell(scene)
const textureLoader = new TextureLoader().setCrossOrigin('anonymous')
const resolution = pickResolution(renderer.capabilities.maxTextureSize)
let currentFrame: GoesFrame | null = null

async function refreshGoes() {
  const frame = await fetchLatestFrame(resolution)
  if (currentFrame && frame.url === currentFrame.url) return
  const tex = await textureLoader.loadAsync(frame.url)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy()
  goes.setTexture(tex)
  currentFrame = frame
}
void refreshGoes()
setInterval(() => void refreshGoes(), 10 * 60 * 1000)

// Painel para calibrar a máscara de nuvem durante o spike.
const gui = new GUI({ title: 'GOES' })
gui.add(goes.material.uniforms.cloudBrightness!, 'value', 0, 1, 0.01).name('brilho mín. nuvem')
gui.add(goes.material.uniforms.cloudMaxSaturation!, 'value', 0, 0.5, 0.01).name('saturação máx.')
```

No loop, logo depois de `const alt = globe.cameraAltitude()`, adicione:
```ts
  goes.setAltitude(alt)
```

E acrescente ao objeto passado para `debug.set(...)`:
```ts
    goes: currentFrame
      ? currentFrame.isFallback
        ? 'FALLBACK (horário desconhecido)'
        : `${currentFrame.time!.toISOString().slice(11, 16)} UTC · há ${frameAgeMinutes(currentFrame.time!, new Date())} min · ${frameStatus(currentFrame.time, new Date())} · ${resolution}px`
      : 'carregando…',
```

- [ ] **Step 3: Verificar visualmente**

Run: `npm run dev` → `http://localhost:5173/spike.html`

Expected:
- Em órbita, o disco do GOES cobre o globo e a imagem bate com os continentes por baixo. Gire o globo e confira o contorno da costa do RS/Uruguai/Rio da Prata e do Chile. Erro aceitável: **poucos km** (critério 2 do spike).
- O lado do globo que o GOES não enxerga (Ásia/Pacífico oeste) mostra só os tiles do Google, sem textura esticada.
- Entre 5.000 e 500 km, o "chão" do GOES some e ficam só as nuvens sobre os tiles nítidos.
- Entre 500 e 30 km, as nuvens afinam até sumir. Movendo a câmera inclinada, as nuvens têm paralaxe em relação ao chão.
- O painel mostra o horário do frame e `fresh`.
- Teste de falha: bloqueie `cdn.star.nesdis.noaa.gov` no DevTools (Network → Block request domain) e recarregue: o painel mostra `FALLBACK` e o globo continua com a imagem embutida.

Calibre os dois controles do painel `GOES` até a máscara separar bem nuvem de solo claro (Atacama, Patagônia, neve dos Andes). Anote os valores finais para a Task 10.

- [ ] **Step 4: Commit**

```bash
git add spike/goesShell.ts spike/main.ts
git commit -m "spike: casca GOES com reprojeção fixed grid e máscara de nuvem"
```

---

### Task 9: Spike — atmosfera Takram com pós-processamento

**Files:**
- Create: `spike/atmosphere.ts`
- Modify: `spike/main.ts`

**Interfaces:**
- Consumes: `renderer`, `camera`, `scene` da Task 7; `currentFrame.time` da Task 8 (para a posição do sol).
- Produces: `createAtmosphere(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera): Promise<{ composer: EffectComposer; setDate(date: Date): void; render(): void; setSize(w: number, h: number): void }>`

- [ ] **Step 1: Criar `spike/atmosphere.ts`**

```ts
// Atmosfera física (Takram): céu, borda azul do planeta e névoa de distância.
// Tudo em ECEF. Exige buffer de ponto flutuante (HalfFloatType) no composer.
import { HalfFloatType, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from 'postprocessing'
import {
  AerialPerspectiveEffect,
  PrecomputedTexturesGenerator,
  getSunDirectionECEF,
} from '@takram/three-atmosphere'

export async function createAtmosphere(renderer: WebGLRenderer, scene: Scene, camera: PerspectiveCamera) {
  const aerialPerspective = new AerialPerspectiveEffect(camera, {
    sky: true, // desenha o céu onde não há geometria
    sunLight: true, // ilumina os tiles (que vêm sem iluminação) como albedo
    skyLight: true,
    reconstructNormal: true, // tiles do Google não têm buffer de normais
  })

  const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType, multisampling: 0 })
  composer.addPass(new RenderPass(scene, camera))
  composer.addPass(new EffectPass(camera, aerialPerspective))
  composer.addPass(new EffectPass(camera, new ToneMappingEffect({ mode: ToneMappingMode.AGX })))

  const generator = new PrecomputedTexturesGenerator(renderer)
  const textures = await generator.update()
  Object.assign(aerialPerspective, textures)

  const sunDirection = new Vector3()

  return {
    composer,
    setDate(date: Date) {
      getSunDirectionECEF(date, sunDirection)
      aerialPerspective.sunDirection.copy(sunDirection)
    },
    render() {
      composer.render()
    },
    setSize(w: number, h: number) {
      composer.setSize(w, h)
    },
  }
}
```

- [ ] **Step 2: Integrar em `spike/main.ts`**

Adicione ao topo:
```ts
import { createAtmosphere } from './atmosphere'
```

Depois da criação de `globe`, adicione:
```ts
// A atmosfera pode ser desligada pela URL (?atm=0) para comparar fps e visual.
const useAtmosphere = new URLSearchParams(location.search).get('atm') !== '0'
const atmosphere = useAtmosphere ? await createAtmosphere(renderer, scene, camera) : null
```

No handler de `resize`, acrescente:
```ts
  atmosphere?.setSize(window.innerWidth, window.innerHeight)
```

No loop, troque `renderer.render(scene, camera)` por:
```ts
  if (atmosphere) {
    // Sol na posição do horário do frame GOES (ou agora, se for o fallback).
    atmosphere.setDate(currentFrame?.time ?? new Date())
    atmosphere.render()
  } else {
    renderer.render(scene, camera)
  }
```

Observação: `await` no nível do módulo funciona porque `spike/main.ts` é um módulo ES carregado pelo Vite.

- [ ] **Step 3: Verificar visualmente**

Run: `npm run dev` → `http://localhost:5173/spike.html` (com atmosfera) e `http://localhost:5173/spike.html?atm=0` (sem).

Expected:
- Em órbita: borda azul fina em volta do planeta; o espaço fica preto.
- Altitudes médias: névoa azulada aumenta com a distância no horizonte quando a câmera inclina.
- A ~150 m: céu visível no horizonte, prédios com cor natural (não "lavados" nem pretos), **sem tremedeira**.
- O lado noturno dos tiles fica escuro de acordo com o horário do frame GOES (esperado; dia/noite real nas altitudes baixas está fora do MVP, ver Task 10).
- Nenhum erro de shader no console.

Anote para a Task 10: fps mínimo com e sem atmosfera durante a descida; problemas visuais (céu, cor, artefatos na casca GOES dentro do aerial perspective); comportamento com o depth buffer logarítmico.

Se a atmosfera quebrar com `logarithmicDepthBuffer` (céu desenhado na frente dos prédios, ou fundo preto), tente nesta ordem e anote o que funcionou: (1) `new AerialPerspectiveEffect(camera, { ..., correctGeometricError: false })`; (2) criar o renderer com `reversedDepthBuffer: true` em vez de `logarithmicDepthBuffer: true` (precisa de `EXT_clip_control`); (3) registrar o problema como falha do critério 3.

- [ ] **Step 4: Commit**

```bash
git add spike/atmosphere.ts spike/main.ts
git commit -m "spike: atmosfera Takram com aerial perspective"
```

---

### Task 10: Relatório do spike e decisão passa/não passa

**Files:**
- Create: `docs/superpowers/spikes/2026-10-06-fase0-resultado.md`
- Modify (só se a decisão mudar algo): `docs/superpowers/specs/2026-10-06-earth-live-simulator-design.md`

**Interfaces:**
- Consumes: anotações das Tasks 7–9.
- Produces: decisão registrada (`PASSA` → Plano 2 com Three.js; `NÃO PASSA` → revisar a spec para CesiumJS) e os valores calibrados que o Plano 2 deve usar.

- [ ] **Step 1: Medir com rigor**

Com `npm run dev` aberto em `spike.html`, em janela de navegador maximizada (anote resolução e GPU — `chrome://gpu`):
1. Faça três descidas contínuas de órbita até 150 m sobre o Centro Histórico de Porto Alegre, segurando o scroll.
2. Anote o menor fps visto no painel em cada descida, com e sem `?atm=0`.
3. A 150 m, gire a câmera lentamente por 10 s e observe tremedeira/z-fighting.
4. Compare o contorno do GOES com a costa em três pontos: Rio da Prata, Lagoa dos Patos, Chiloé.

- [ ] **Step 2: Escrever o relatório**

`docs/superpowers/spikes/2026-10-06-fase0-resultado.md`:
```markdown
# Fase 0 — Resultado do spike

**Data:** <data>  **GPU / navegador / resolução:** <preencher>

| Critério | Meta | Medido | Resultado |
|---|---|---|---|
| 1. Desempenho na descida | ≥ 45 fps | <menor fps com atmosfera> / <sem atmosfera> | PASSA / NÃO PASSA |
| 2. Alinhamento GOES × costa | poucos km | Rio da Prata: <…>; Lagoa dos Patos: <…>; Chiloé: <…> | PASSA / NÃO PASSA |
| 3. Atmosfera de 36.000 km a 150 m | funciona com 3D Tiles | <descrição; qual configuração de depth funcionou> | PASSA / NÃO PASSA |
| 4. Sem jitter a 150 m | sem tremedeira | <descrição> | PASSA / NÃO PASSA |

## Sensação do zoom (GlobeControls)
<contínuo? rápido demais perto do chão? decide se o Plano 2 cria core/altitude.ts>

## Valores calibrados
- cloudBrightness: <valor>
- cloudMaxSaturation: <valor>

## Problemas encontrados e contornos
<lista>

## Decisão
PASSA → escrever o Plano 2 (Fases 1–5) com Three.js + 3d-tiles-renderer + Takram.
ou
NÃO PASSA (critério <n>) → revisar a spec para CesiumJS antes de qualquer plano novo.
```

Preencha todos os campos com o que foi medido. Um critério sem medição conta como NÃO PASSA.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/spikes/2026-10-06-fase0-resultado.md
git commit -m "docs: resultado do spike da Fase 0"
```

- [ ] **Step 4: Parar e apresentar a decisão ao dono do projeto**

Não comece o Plano 2 sem a aprovação dele sobre o relatório.
