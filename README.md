# Earth Live Simulator

A browser simulator that starts you in geostationary orbit (~35,786 km), seeing Earth
the way the **GOES-19** satellite sees it right now, and takes you down in one
continuous descent to drone altitude (~150 m) over Google Photorealistic 3D Tiles.

> **Status:** Phase 0 (technical spike) in progress. The code lives on the
> `feat/fase0-fundacao-spike` branch until the spike decision is made. The design
> spec and plans are in [`docs/superpowers/`](docs/superpowers/), currently written
> in Portuguese.

## Stack

TypeScript + Vite, [three.js](https://threejs.org/),
[3d-tiles-renderer](https://github.com/NASA-AMMOS/3DTilesRendererJS),
[@takram/three-atmosphere](https://github.com/takram-design-engineering/three-geospatial)
and Vitest.

## Getting started

Requires Node.js 22.12+ or 24+.

```bash
npm install
cp .env.example .env.local   # then fill in the key (see below)
npm run dev                  # open http://localhost:5173/spike.html
npm test                     # unit tests
npm run typecheck
```

### Google Map Tiles API key

1. In the [Google Cloud Console](https://console.cloud.google.com), enable the
   **Map Tiles API** in a project with billing enabled.
2. Create an API key and **restrict it**:
   - API restriction: Map Tiles API only;
   - application restriction: HTTP referrers `http://localhost:5173/*`.
3. Set a budget with a billing alert.
4. Put the key in `.env.local` as `VITE_GOOGLE_MAP_TILES_KEY=...`.

`.env.local` is in `.gitignore`. Never commit it. `VITE_*` variables are embedded in
the JavaScript that ships to the browser, so anyone who opens a published build can
read the key. If you publish a build, use a separate key restricted to the published
domain.

## Third-party data and licenses

- **GOES-19 (NOAA/NESDIS):** public-domain imagery. The frame in `public/fallback/`
  is shown when the live feed is unavailable.
- **Google Photorealistic 3D Tiles:** accessed through the API under the
  [Google Maps Platform terms](https://cloud.google.com/maps-platform/terms).
  Attribution is required, and tiles must not be cached or redistributed.

## License

The code in this repository is licensed under the [GNU AGPL-3.0](LICENSE). That
license does not cover the third-party data listed above, which keeps its own
licenses.
