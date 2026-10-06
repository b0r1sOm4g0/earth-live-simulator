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
    // Desenhada como sobreposição (cena própria): a casca a 12 km fica sempre acima
    // dos tiles, e FrontSide já descarta o hemisfério de trás.
    depthTest: false,
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
