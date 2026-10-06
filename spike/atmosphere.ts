// Atmosfera física (Takram): céu, borda azul do planeta e névoa de distância.
// Tudo em ECEF. Exige buffer de ponto flutuante (HalfFloatType) no composer.
import { HalfFloatType, PerspectiveCamera, Scene, Vector3, WebGLRenderer } from 'three'
import { CopyPass, EffectComposer, EffectPass, RenderPass, ToneMappingEffect, ToneMappingMode } from 'postprocessing'
import {
  AerialPerspectiveEffect,
  PrecomputedTexturesGenerator,
  getSunDirectionECEF,
} from '@takram/three-atmosphere'

/**
 * `overlayScene` (camada GOES) é desenhada DEPOIS da atmosfera e do tone mapping:
 * a imagem do GOES já é uma foto com atmosfera e iluminação reais, então não deve
 * receber a atmosfera de novo. Além disso, como ela não escreve profundidade, o
 * efeito de atmosfera a trataria como "céu vazio" e pintaria o céu por cima.
 */
export async function createAtmosphere(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  overlayScene: Scene,
) {
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
  const overlayPass = new RenderPass(overlayScene, camera)
  overlayPass.clearPass.enabled = false // desenha por cima do resultado anterior
  composer.addPass(overlayPass)
  composer.addPass(new CopyPass()) // último passe: copia para a tela (com conversão sRGB)

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
