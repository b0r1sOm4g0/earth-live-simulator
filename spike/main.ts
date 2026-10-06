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
