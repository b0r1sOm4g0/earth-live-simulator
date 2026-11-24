# Earth Live Simulator

Simulador no navegador em que você começa na órbita geoestacionária (~35.786 km),
vendo a Terra como o satélite **GOES-19** a vê agora, e desce de forma contínua até
a altitude de um drone (~150 m), sobre os Google Photorealistic 3D Tiles.

> **Status:** Fase 0 (spike técnico) em andamento. O código está na branch
> `feat/fase0-fundacao-spike` até sair a decisão do spike. Design e planos ficam em
> [`docs/superpowers/`](docs/superpowers/).

## Stack

TypeScript + Vite, [three.js](https://threejs.org/),
[3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS),
[@takram/three-atmosphere](https://github.com/takram-design-engineering/three-geospatial)
e Vitest.

## Como rodar

Requisitos: Node.js 22.12+ ou 24+.

```bash
npm install
cp .env.example .env.local   # depois preencha a key (veja abaixo)
npm run dev                  # abra http://localhost:5173/spike.html
npm test                     # testes unitários
npm run typecheck
```

### Key do Google Map Tiles API

1. No [Google Cloud Console](https://console.cloud.google.com), ative a **Map Tiles API**
   num projeto com faturamento ativo.
2. Crie uma chave de API e **restrinja-a**:
   - restrição de API: só a Map Tiles API;
   - restrição de aplicativo: referenciadores HTTP `http://localhost:5173/*`.
3. Configure um orçamento com alerta de cobrança.
4. Coloque a key em `.env.local` como `VITE_GOOGLE_MAP_TILES_KEY=...`.

O `.env.local` está no `.gitignore`; nunca faça commit dele. Variáveis `VITE_*` são
embutidas no JavaScript que vai para o navegador. Se publicar um build, quem abrir a
página consegue ver a key. Nesse caso, use uma key separada, restrita ao domínio
publicado.

## Dados e licenças de terceiros

- **GOES-19 (NOAA/NESDIS):** imagens de domínio público. O frame em
  `public/fallback/` é usado quando o feed ao vivo não está disponível.
- **Google Photorealistic 3D Tiles:** usados pela API, sob os
  [termos do Google Maps Platform](https://cloud.google.com/maps-platform/terms).
  A atribuição é obrigatória e os tiles não podem ser cacheados ou redistribuídos.

## Licença

O código deste repositório está sob a [GNU AGPL-3.0](LICENSE). Isso não cobre os dados
de terceiros listados acima, que seguem as licenças deles.
