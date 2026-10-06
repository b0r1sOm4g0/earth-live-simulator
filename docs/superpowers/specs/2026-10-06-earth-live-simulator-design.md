# Earth Live Simulator — Design (MVP)

**Data:** 2026-10-06
**Status:** aguardando revisão
**Caminho:** arquitetural (projeto novo)

---

## 1. Visão

Um visualizador/jogo no navegador em que o jogador começa na órbita geoestacionária
(~35.786 km, vendo a Terra como o GOES-19 a vê **agora**) e desce de forma contínua e
suave até a altitude de um drone de segurança (~100–200 m), com a escala, a resolução,
o sensor simulado e o estilo visual mudando naturalmente ao longo da descida.

Referência de sensação: **Google Earth VR** — globo 3D, voo livre, prédios 3D,
presença — mas com a imagem real do GOES-19 nas altitudes altas.

### Propósito (acordado)
- Combinação de **experiência visual** ("uau" de descer da órbita) e **jogo**
  (missões em zonas curadas, pós-MVP).
- Foco em **qualidade e jogabilidade**. Não há meta comercial no MVP.
- Comercialização futura possível via **download direto ou SaaS próprio** —
  não lojas. Por isso: web/TypeScript.
- **VR (WebXR) em 6–12 meses.** O MVP é desktop, mas a arquitetura não pode
  fechar a porta para WebXR.

### Diretrizes de código
O código precisa ser modular, comentado e com arquivos pequenos de responsabilidade única.

---

## 2. Decisões principais

| Decisão | Escolha | Motivo |
|---|---|---|
| Plataforma | Web (navegador), TypeScript + Vite | Stack que o dono já usa; vira SaaS ou download (Tauri/Electron) sem reescrever. |
| Engine 3D | **Three.js + `3d-tiles-renderer` (NASA-AMMOS)** | Controle total de shaders (transição GOES, lentes de sensor, térmico futuro) e melhor caminho para WebXR. |
| Atmosfera | **`@takram/three-atmosphere`** (MIT) | Espalhamento atmosférico físico: borda azul do planeta e névoa de distância. |
| Superfície | **Google Photorealistic 3D Tiles** | Globo inteiro + malha 3D fotorrealista em cidades (Porto Alegre incluída). |
| Imagem GEO | **GOES-19 ABI, setor SSA, GEOCOLOR 7200×4320** (NOAA STAR CDN) | Domínio público; o setor da América do Sul tem mais resolução no Cone Sul que o full disk. |
| UI | React (somente HUD) + Zustand | Separação clara entre engine e HUD; stack conhecida. |
| Testes | Vitest (matemática pura) + Playwright (faixa visual da descida) | |
| Alternativa de recuo | CesiumJS | Usada só se o spike (Fase 0) reprovar. |

Rejeitado: **Cesium for Unreal** (C++/Blueprints e assets binários são ruins
para desenvolvimento com IA; não roda no navegador).

---

## 3. Fora do escopo do MVP

- Modo térmico (só a estrutura da `SensorLens` fica pronta para recebê-lo).
- Missões / modos de jogo.
- Pessoas como entidades sintéticas.
- Nuvens volumétricas 3D (Takram `clouds`).
- Dia/noite real nas altitudes baixas (a superfície fica sempre com luz de dia;
  só a camada GOES mostra a noite real).
- WebXR, multiplayer, dados meteorológicos além do GOES.
- Zonas fora de Porto Alegre.
- Backend próprio (só o proxy do Vite em dev).

---

## 4. Modelo de altitude e câmera

### 4.1 Altitude como fonte única da verdade
Um único valor, `altitude` (metros), determina tudo: opacidade das camadas,
plataforma e sensor ativos, velocidade do pan, tilt, lente e HUD. Nenhum módulo
consulta "nível de zoom" de mapa.

- Acima de 10 km: altitude acima do elipsoide WGS84.
- Abaixo de 10 km: altitude acima do solo (AGL), por raycast contra os 3D Tiles
  (se o raycast falhar, usa o elipsoide).
- Limites: máximo **36.000 km**; mínimo **100 m AGL** dentro de zona;
  **piso suave de 1 km** fora de zona (ver §6).

### 4.2 Zoom logarítmico com inércia (`core/altitude.ts`)
- O estado tem `altitude` e `targetAltitude`.
- Cada evento de scroll multiplica `targetAltitude` por um fator
  (padrão: ×0,85 para descer, ×1/0,85 para subir, por "notch").
- Por frame: `log(alt) += (log(target) − log(alt)) · (1 − e^(−dt/τ))`,
  com τ ≈ 0,25 s (ajustável). O resultado é descida contínua, sem degraus.
- Botões +/−, pinch e teclas W/S (descida contínua enquanto pressionadas)
  usam o mesmo mecanismo.
- Função pura e testável, sem dependência de Three.js.

### 4.3 Controlador de câmera (`camera/GlobeCameraController.ts`)
- **Zoom no cursor:** o ponto do globo sob o cursor permanece fixo na tela durante
  o zoom.
- **Pan por "agarrar":** o ponto agarrado acompanha o mouse; a velocidade fica
  naturalmente proporcional à altitude.
- **Tilt automático:** 0° (nadir) acima de 50 km; interpolação em log da altitude
  até 35° em 150 m. Tecla **T** alterna entre nadir e inclinado (override manual).
- **Home:** volta suavemente para a órbita GEO sobre o ponto subsatélite do GOES-19
  (0°, 75,2°W).
- **Chão seguro:** raycast contra os tiles impede descer abaixo do mínimo.
- **Precisão em escala planetária:** depth buffer logarítmico + renderização
  relativa à câmera (evita jitter e z-fighting a 150 m).

### 4.4 Faixas de escala (`core/scaleBands.ts`)
As faixas são **configuração, não código**. Cada faixa define plataforma, sensor,
IFOV (para o GSD) e o "look" da lente. As curvas de opacidade das camadas são
definidas **à parte** (§5), indexadas pela altitude, porque não coincidem com as
fronteiras de rótulo.

| Faixa | Altitude | Plataforma (HUD) | Sensor | IFOV inicial | GSD resultante |
|---|---|---|---|---|---|
| GEO | 36.000 → 1.000 km | GOES-19 ABI | GEOCOLOR | 28 µrad | ~1 km → ~28 m |
| LEO | 1.000 → 50 km | Satélite LEO (classe Sentinel-2) | RGB | 12,7 µrad | ~13 m → ~0,6 m |
| HALE | 50 → 5 km | RQ-4 Global Hawk (EO) | RGB | 60 µrad | ~3 m → ~0,3 m |
| DRONE | 5 km → 200 m | DJI Matrice 4TD (wide) | RGB | 216 µrad | ~1,1 m → ~4 cm |
| HOVER | < 200 m | DJI Matrice 4TD (wide) | RGB | 216 µrad | < 4 cm |

- `GSD = altitude × IFOV`. Os valores são iniciais e devem ser ajustados por sensação.
- O GSD exibido é o **do sensor simulado**, não a resolução real dos tiles na tela.
- Fora de uma zona de drone, as faixas DRONE e HOVER não são alcançáveis (piso de 1 km).

---

## 5. Pilha de camadas visuais

### 5.1 Camada 0 — Superfície (`layers/SurfaceLayer.ts`)
- Google Photorealistic 3D Tiles via plugin do `3d-tiles-renderer`.
- O LOD é gerenciado pelo renderer (erro em pixels na tela, `errorTarget` configurável).
- Key em `.env.local` (`VITE_GOOGLE_MAP_TILES_KEY`), nunca no código.
- **Fallback:** imagem XYZ sobre o elipsoide (para dev, se a key falhar ou a cota estourar).

### 5.2 Camada 1 — GOES-19 SSA GEOCOLOR (`layers/GoesLayer.ts`, `layers/goesProjection.ts`)
- Uma **casca esférica a ~12 km de altitude** (topo de nuvens), transparente.
- Fragment shader: posição na casca → lat/lon → ângulos de varredura do
  satélite (projeção geoestacionária fixed-grid do GOES-R) → UV da imagem.
  Fora da área da imagem: alfa 0.
- **Máscara de nuvem aproximada:** alfa de nuvem derivado de brilho alto + baixa
  saturação. Os limiares são uniforms ajustáveis.
- **Três atos de opacidade** (por altitude da câmera):

| Ato | Altitude | "Chão" do GOES (pixels não-nuvem) | Nuvens do GOES |
|---|---|---|---|
| 1 | 36.000 → 5.000 km | opaco | opaco |
| 2 | 5.000 → 500 km | some (1 → 0) | opaco |
| 3 | 500 → 30 km | 0 | afina (1 → 0) |
| — | < 30 km | 0 | 0 (camada desligada) |

- As nuvens a 12 km ganham paralaxe em relação ao chão quando a câmera se move.
- A noite do GEOCOLOR (luzes de cidade, IR) aparece naturalmente no ato 1.
- `goesProjection.ts` é matemática pura (lat/lon ↔ ângulo de varredura), testada
  com valores de referência do GOES-R Product User Guide.

### 5.3 Camada 2 — Atmosfera (`layers/AtmosphereLayer.ts`)
- Takram `atmosphere`: céu, borda do planeta e aerial perspective.
- Posição do sol calculada para o **horário UTC do frame GOES** exibido.

### 5.4 Camada 3 — Lente do sensor (`layers/SensorLens.ts`)
- Pós-processamento com um "look" por faixa, com interpolação na fronteira:
  - **GEO:** leve suavização + granulação de satélite.
  - **LEO / HALE:** limpo e nítido.
  - **DRONE / HOVER:** vinheta leve, nitidez de câmera, ruído sutil.
- Interface pensada para receber "looks" extras (térmico) sem mudar o resto.

---

## 6. Zonas de drone e conteúdo sintético

### 6.1 Zonas (`zones/ZoneManager.ts`, `zones/*.json`)
Cada zona é um arquivo de dados: área de cobertura (centro + raio), base do drone,
rotas de patrulha, rotas de veículos.

- **Fora de zona:** ao se aproximar de 1 km, a descida encontra resistência elástica
  (sem muro) e o HUD mostra
  `SEM COBERTURA DE DRONE · base mais próxima: <nome>, <distância>`
  com um botão que voa até a base.
- **Dentro de zona:** abaixo de ~1 km ativa o modo drone: plataforma vira o drone
  da base, a lente muda e as entidades aparecem.
- Expandir para novas regiões = adicionar arquivos de zona.

### 6.2 Zona inicial: Porto Alegre — Centro Histórico + Orla do Guaíba
- Base fictícia ("Dock") próxima ao Cais Mauá (≈ −30,0277, −51,2287).
- Raio de cobertura inicial: 3 km.
- Patrulha: orla do Cais Mauá até a Usina do Gasômetro (≈ −30,0340, −51,2414).
- Coordenadas exatas e rotas são definidas na implementação, sobre os tiles.

### 6.3 Entidades sintéticas (`zones/entities/`)
- `Drone.ts`: 1–2 drones fictícios em patrulha; o marcador da base é visível do alto.
- `Vehicle.ts`: alguns veículos low-poly seguindo LineStrings desenhadas sobre ruas.
- Entidades são posicionadas sobre a superfície por raycast (altura do terreno/prédios).
- Interface comum de entidade (`update(dt)`, `object3D`) preparada para pessoas
  e alvos de missão no pós-MVP.

---

## 7. HUD (`hud/`, React + Zustand)

A engine publica um snapshot por frame (com throttle) em `state/store.ts`.
O HUD só lê; ações do HUD (botões) chamam comandos da engine pelo store.

- **Altímetro vertical logarítmico** (lateral): régua de 36.000 km a 100 m,
  com faixas marcadas (GEO · LEO · HALE · DRONE) e cursor descendo.
- **Telemetria:** altitude (unidade automática km/m), GSD (km/px, m/px, cm/px),
  plataforma + sensor, lat/lon do centro, rumo, tilt.
- **Selo do frame GOES:** `GOES-19 · 14:20 UTC · há 7 min`; fica âmbar quando
  o frame tem mais de 1 h.
- **Banner de cobertura** (§6.1).
- **Controles visíveis:** botões +/−, Home, alternar tilt.
- **Atalhos:** scroll, +/−, W/S, T, Home.
- **Responsivo:** no celular, o altímetro encolhe e a telemetria vira uma faixa compacta.
- Estética: ISR/militar minimalista, alto contraste, fonte monoespaçada nos números.

---

## 8. Dados

### 8.1 Feed GOES (`data/goesFeed.ts`)
- Origem: `https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/ssa/GEOCOLOR/`
  (mesma lógica do `pachamama-live/goes_stream.sh`): lista o diretório, pega o
  arquivo `*_GOES19-ABI-ssa-GEOCOLOR-7200x4320.jpg` mais recente.
- O timestamp é extraído do nome do arquivo (formato `YYYYDDDHHMM`).
- Polling a cada 10 min; troca de textura com crossfade curto.
- **CORS:** em dev, via proxy do Vite (`/noaa/*`). Em produção futura, uma função
  serverless/cron que copia o frame para storage próprio (fora do MVP).
- Em GPUs com `MAX_TEXTURE_SIZE < 8192`, usa a variante de resolução menor do mesmo setor.

### 8.2 Google 3D Tiles
- Key via `.env.local`. Atribuição exibida conforme os termos do Google.
- Uso pessoal no protótipo, dentro da cota gratuita (verificar os números atuais
  ao configurar a key).

### 8.3 Licenças
- GOES (NOAA): domínio público.
- Google 3D Tiles: uso via API, sem cache próprio; atribuição obrigatória.
- A fonte de superfície fica atrás da interface `SurfaceLayer` para poder ser
  trocada se o modelo comercial exigir.

---

## 9. Tratamento de erros

| Falha | Comportamento |
|---|---|
| NOAA fora do ar / listagem falha | Usa o último frame em cache; senão `public/fallback/goes-ssa.jpg`. Selo do HUD fica âmbar com a idade do frame. |
| Key do Google ausente/inválida/cota | Banner explicativo + fallback XYZ sobre o elipsoide. |
| Sem WebGL2 | Tela de aviso; o app não inicia. |
| Raycast de solo falha | Usa a altitude sobre o elipsoide; mantém o piso mínimo. |

---

## 10. Testes

### 10.1 Unitários (Vitest), sobre módulos puros
- `goesProjection`: lat/lon ↔ ângulo de varredura com valores de referência do GOES-R PUG;
  pontos fora do disco retornam "fora".
- `altitude`: convergência do amortecimento log, fator por notch, limites min/max.
- `scaleBands` / `gsd`: faixa correta por altitude, GSD esperado, interpolação nas fronteiras.
- Curvas de opacidade dos três atos do GOES.
- `ZoneManager`: dentro/fora da cobertura, base mais próxima e distância.
- `units`: formatação km/m/cm.
- `goesFeed`: parse do nome do arquivo → timestamp; escolha do mais recente.

### 10.2 Visual (Playwright)
"Faixa de descida": screenshots fixos sobre Porto Alegre em
36.000 / 5.000 / 500 / 30 / 1 / 0,15 km, com frame GOES de fallback fixo para que
o resultado seja determinístico. Serve para revisar transições e detectar regressões.

---

## 11. Fases

### Fase 0 — Spike técnico (passa/não passa)
Protótipo descartável: globo com Google 3D Tiles + GOES SSA projetado com
crossfade + atmosfera Takram + zoom de 36.000 km a 150 m sobre Porto Alegre.

Critérios:
1. ≥ 45 fps em desktop durante a descida completa.
2. Contorno do GOES alinhado à costa com erro de poucos km (confirma a projeção
   e os limites do setor SSA; senão, recuar para o full disk).
3. Atmosfera Takram funcionando de 36.000 km a 150 m junto com os 3D Tiles.
4. Sem jitter/z-fighting a 150 m.

Se reprovar em 3 ou 4 sem solução razoável: recuar para CesiumJS e revisar esta spec.

### Fases do MVP
1. Altitude + câmera + superfície (zoom log, zoom no cursor, pan, tilt, chão seguro).
2. Camada GOES (feed, projeção, máscara de nuvem, três atos).
3. Atmosfera + lente do sensor.
4. HUD.
5. Zona de Porto Alegre + entidades (drones, veículos, banner de cobertura).

---

## 12. Estrutura de pastas

```
earth-live-simulator/
  src/
    main.ts
    core/        altitude.ts, scaleBands.ts, gsd.ts, units.ts
    camera/      GlobeCameraController.ts
    layers/      SurfaceLayer.ts, GoesLayer.ts, goesProjection.ts,
                 AtmosphereLayer.ts, SensorLens.ts, shaders/
    data/        goesFeed.ts
    zones/       ZoneManager.ts, entities/{Drone,Vehicle}.ts, porto-alegre.json
    hud/         Hud.tsx, Altimeter.tsx, Telemetry.tsx, CoverageBanner.tsx
    state/       store.ts
  public/fallback/goes-ssa.jpg
  tests/         unit/, visual/
  docs/superpowers/specs/
  .env.local     (não versionado)
```

---

## 13. Riscos e pontos a validar

| Risco | Mitigação |
|---|---|
| Projeção/limites exatos do setor SSA desconhecidos | Validar no spike; recuo para o full disk (limites documentados). |
| `three-geospatial` em beta/alpha, migrando para WebGPU | Fixar versões; validar no spike; a atmosfera fica isolada em `AtmosphereLayer`. |
| Cota/custo do Google 3D Tiles | Monitorar o uso; fallback XYZ; superfície atrás de interface. |
| Máscara de nuvem por brilho confunde neve/areia clara com nuvem | Aceitável no MVP; limiares ajustáveis; pós-MVP pode usar o produto de máscara de nuvem do GOES. |
| Desempenho com textura 7200×4320 + tiles + atmosfera | Medido no critério 1 do spike; variante de resolução menor. |
