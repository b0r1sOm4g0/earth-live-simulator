// Spike da Fase 0: valida a pilha Three.js + 3d-tiles-renderer (+ GOES + Takram nas Tasks 8–9).
import { PerspectiveCamera, Scene, SRGBColorSpace, TextureLoader, WebGLRenderer } from 'three'
import GUI from 'lil-gui'
import { createGlobe } from './globe'
import { createDebugOverlay } from './debugOverlay'
import { createGoesShell } from './goesShell'
import { bandAt, gsdAt } from '../src/core/scaleBands'
import { formatAltitude, formatGsd } from '../src/core/units'
import { fetchLatestFrame, pickResolution, frameAgeMinutes, frameStatus, type GoesFrame } from '../src/data/goesFeed'

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
  goes.setAltitude(alt)
  const band = bandAt(alt)
  debug.set({
    altitude: formatAltitude(alt),
    faixa: band.id,
    sensor: `${band.platform} · ${band.sensor}`,
    gsd: formatGsd(gsdAt(alt)),
    fps: fps.toFixed(0),
    goes: currentFrame
      ? currentFrame.isFallback
        ? 'FALLBACK (horário desconhecido)'
        : `${currentFrame.time!.toISOString().slice(11, 16)} UTC · há ${frameAgeMinutes(currentFrame.time!, new Date())} min · ${frameStatus(currentFrame.time, new Date())} · ${resolution}px`
      : 'carregando…',
  })
})
