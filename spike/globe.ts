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

  // O GlobeControls limita o afastamento a "globo com metade do tamanho do FOV"
  // (~15.700 km de altitude com FOV 60°), o que impede voltar à órbita GEO.
  // No spike, sobrescrevemos esse método interno com a nossa altitude máxima.
  // Solução definitiva (Plano 2): FOV mais estreito nas altitudes altas.
  const overridable = controls as unknown as { _getMaxPerspectiveDistance: () => number }
  overridable._getMaxPerspectiveDistance = () => MAX_ALTITUDE + tiles.ellipsoid.radius.x

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
    /** Latitude/longitude (graus) do ponto abaixo da câmera. */
    cameraLatLonDeg(): { lat: number; lon: number } {
      tmp.copy(camera.position)
      tiles.ellipsoid.getPositionToCartographic(tmp, carto)
      return { lat: carto.lat * MathUtils.RAD2DEG, lon: carto.lon * MathUtils.RAD2DEG }
    },
    update() {
      controls.update()
      camera.updateMatrixWorld()
      tiles.setResolutionFromRenderer(camera, renderer)
      tiles.update()
    },
  }
}
