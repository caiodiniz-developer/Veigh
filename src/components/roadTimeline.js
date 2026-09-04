import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * A linha do tempo como estrada.
 *
 * A câmera percorre uma estrada escura; os anos estão pintados no asfalto e as
 * fotografias daquele período ficam de pé nas margens. Chegar a um ano
 * desacelera a câmera e muda a luz da cena inteira.
 *
 * Por que estrada e não linha, disco ou constelação: o site já tem uma esfera
 * de partículas (o planeta) e já tem vinil (a discografia). Repetir qualquer um
 * dos dois faria a timeline parecer variação de outra seção em vez de capítulo
 * próprio.
 *
 * A desaceleração é a peça central. O scroll não mapeia linearmente para a
 * posição da câmera: perto de cada ano a curva achata, então a mesma rolagem
 * avança bem menos estrada. É o que produz a sensação de documentário — o
 * tempo passa mais devagar nos acontecimentos.
 */

const ROAD_W = 9
const ROAD_LEN = 420
const CELL = 256
const COLS = 6

const ROAD_VERT = /* glsl */ `
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const ROAD_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uLight;
  uniform vec3 uFog;
  uniform float uLen;
  varying vec2 vUv;
  varying float vDepth;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Asfalto: escuro com grão fino, senão a estrada lê como plástico.
    float grain = hash(floor(vUv * vec2(600.0, 3000.0)));
    vec3 road = vec3(0.045, 0.028, 0.034) + grain * 0.03;

    // Faixa central tracejada. O traço vive no espaço do plano, então fica
    // parado no mundo e é a câmera que passa por ele.
    float dash = step(0.55, fract(vUv.y * uLen * 0.09));
    float center = smoothstep(0.012, 0.006, abs(vUv.x - 0.5));
    road = mix(road, uLight * 0.85, center * dash * 0.7);

    // Bordas iluminadas: é o que dá direção e velocidade à estrada.
    float edge = smoothstep(0.035, 0.0, abs(abs(vUv.x - 0.5) - 0.47));
    road = mix(road, uLight, edge * 0.55);

    // Névoa por distância: o fim da estrada some no ambiente, sem corte.
    float fog = smoothstep(18.0, 165.0, vDepth);
    gl_FragColor = vec4(mix(road, uFog, fog), 1.0);
  }
`


const CITY_VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute vec3 aScale;
  attribute float aSeed;

  varying vec3 vLocal;
  varying vec3 vNormal;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vec3 scaled = position * aScale;
    // O prédio nasce do chão: a caixa é deslocada meia altura para cima,
    // senão metade dela ficaria enterrada no asfalto.
    vec3 world = aPos + scaled + vec3(0.0, aScale.y * 0.5, 0.0);
    vec4 mv = modelViewMatrix * vec4(world, 1.0);
    vDepth = -mv.z;
    vLocal = scaled;
    vNormal = normal;
    vSeed = aSeed;
    gl_Position = projectionMatrix * mv;
  }
`

const CITY_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uLight;
  uniform vec3 uFog;
  uniform float uTime;
  varying vec3 vLocal;
  varying vec3 vNormal;
  varying float vSeed;
  varying float vDepth;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Fachada quase preta: a cidade é silhueta, não cenário detalhado.
    vec3 col = vec3(0.028, 0.020, 0.026);

    // Janelas acesas. A grade é calculada no espaço do próprio prédio, então
    // todas as janelas têm o mesmo tamanho independentemente de o prédio ser
    // alto ou largo — que é o que faz a escala urbana ficar crível.
    if (abs(vNormal.y) < 0.5) {
      vec2 face = abs(vNormal.x) > 0.5 ? vec2(vLocal.z, vLocal.y) : vec2(vLocal.x, vLocal.y);
      vec2 cell = floor(face / vec2(0.42, 0.62));
      float lit = step(0.66, hash(cell + vSeed * 37.0));
      // A cidade vive: cada janela tem o seu próprio relógio, e de tempos em
      // tempos apaga e volta. Sem isso a fachada é um padrão fixo, e padrão
      // fixo o olho identifica como textura em segundos.
      float slot = floor(uTime * 0.09 + hash(cell) * 40.0);
      lit *= step(0.22, hash(cell + slot * 7.3));
      // Nem toda janela acesa tem o mesmo brilho: prédio com brilho uniforme
      // lê como textura, não como janelas.
      float strength = 0.35 + hash(cell + vSeed * 91.0) * 0.65;
      vec2 inCell = fract(face / vec2(0.42, 0.62));
      float pane = step(0.12, inCell.x) * step(inCell.x, 0.88)
                 * step(0.16, inCell.y) * step(inCell.y, 0.84);
      col += uLight * lit * pane * strength * 1.5;
    }

    // Luz de obstáculo no topo: vermelha, piscando fora de sincronia entre
    // prédios. É o detalhe que datou a silhueta como cidade grande de verdade.
    if (vNormal.y > 0.5) {
      float blink = step(0.72, fract(uTime * 0.35 + vSeed));
      col += vec3(0.9, 0.08, 0.14) * blink * step(0.55, hash(vec2(vSeed, 3.1)));
    }

    float fog = smoothstep(26.0, 175.0, vDepth);
    gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
  }
`

const CAR_VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute float aSize;
  attribute float aSeed;

  varying vec2 vUv;
  varying float vDepth;
  varying float vSeed;

  void main() {
    // A posição vem da CPU, junto com a do carro que carrega esta luz.
    vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
    mv.xy += position.xy * aSize;
    vDepth = -mv.z;
    vUv = uv;
    vSeed = aSeed;
    gl_Position = projectionMatrix * mv;
  }
`

const CAR_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying float vDepth;
  varying float vSeed;

  void main() {
    vec2 d = vUv - 0.5;
    // Achatado na horizontal: farol visto de frente é um traço, não um ponto.
    d.y *= 2.6;
    float r = length(d) * 2.0;
    float a = pow(max(0.0, 1.0 - r), 2.2);
    // Núcleo estourado no meio do halo: farol tem um ponto branco duro dentro
    // do brilho, e é ele que faz a luz ler como lâmpada e não como mancha.
    a += pow(max(0.0, 1.0 - r * 2.6), 6.0) * 0.9;

    // Quem vem na direção da câmera mostra farol; quem se afasta, lanterna.
    vec3 col = vSeed > 0.5
      ? vec3(1.0, 0.94, 0.82)
      : vec3(1.0, 0.14, 0.10);

    a *= 1.0 - smoothstep(70.0, 240.0, vDepth);
    gl_FragColor = vec4(col * a, a);
  }
`

const BODY_VERT = /* glsl */ `
  varying vec3 vCol;
  varying float vDepth;
  void main() {
    vCol = color;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`

const BODY_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uLight;
  uniform vec3 uFog;
  varying vec3 vCol;
  varying float vDepth;
  void main() {
    // A carroceria pega a cor da era, nao um cinza proprio: um carro cinza
    // numa rua de sodio denuncia que ele nao pertence aquela luz.
    vec3 col = vCol * uLight * 2.4;
    float fog = smoothstep(24.0, 165.0, vDepth);
    gl_FragColor = vec4(mix(col, uFog, fog), 1.0);
  }
`

const GLOW_VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute float aSize;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
    mv.xy += position.xy * aSize;
    vDepth = -mv.z;
    vUv = uv;
    gl_Position = projectionMatrix * mv;
  }
`

const GLOW_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uLight;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.6);
    // Some com a distância junto com o resto: um poste brilhando no fim da
    // névoa entregaria que a névoa é falsa.
    a *= 1.0 - smoothstep(30.0, 170.0, vDepth);
    gl_FragColor = vec4(uLight * a, a);
  }
`

const BILL_VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute vec2 aCell;
  attribute vec2 aSize;
  attribute float aFlat;

  uniform vec2 uCellSize;

  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vec3 p = aPos;
    vec4 mv;

    if (aFlat > 0.5) {
      // Pintado no chão: o quad fica deitado, não encara a câmera.
      vec3 local = vec3(position.x * aSize.x, 0.0, -position.y * aSize.y);
      mv = modelViewMatrix * vec4(p + local, 1.0);
    } else {
      // De pé na margem, sempre virado para a câmera.
      mv = modelViewMatrix * vec4(p, 1.0);
      mv.xy += position.xy * aSize;
    }

    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
    vUv = aCell + uv * uCellSize;
  }
`

const BILL_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uAtlas;
  uniform vec3 uFog;
  uniform vec3 uLight;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vec4 c = texture2D(uAtlas, vUv);
    if (c.a < 0.04) discard;
    // A luz da era tinge tudo o que está na estrada.
    c.rgb = mix(c.rgb, c.rgb * uLight * 1.9, 0.34) * 1.5;
    float fog = smoothstep(34.0, 190.0, vDepth);
    gl_FragColor = vec4(mix(c.rgb, uFog, fog), c.a);
  }
`

/**
 * Modela um carro e devolve UMA geometria só.
 *
 * Carroceria, cabine, quatro rodas e a faixa de vidro são construídos
 * separados e fundidos com mergeGeometries. Fundir é o que permite instanciar:
 * quatorze carros viram uma draw call em vez de noventa e oito meshes.
 *
 * Não há luz na cena — de noite, numa estrada, o carro é silhueta. Em vez de
 * material que reage a luz, a forma é lida por cor de vértice assada a partir
 * da normal: face para cima recebe o céu, face lateral fica quase preta. Sai
 * mais barato que um MeshStandardMaterial com luzes e, num contraluz, é
 * exatamente o que o olho espera ver.
 */
function buildCar() {
  const parts = []

  const body = new THREE.BoxGeometry(1.85, 0.62, 4.3)
  body.translate(0, 0.62, 0)
  parts.push(body)

  // Cabine recuada e mais estreita: é o degrau entre capô e teto que faz a
  // silhueta ler como carro e não como caixa.
  const cabin = new THREE.BoxGeometry(1.62, 0.56, 2.15)
  cabin.translate(0, 1.2, -0.18)
  parts.push(cabin)

  const glass = new THREE.BoxGeometry(1.66, 0.3, 2.2)
  glass.translate(0, 1.2, -0.18)
  parts.push(glass)

  const wheel = () => new THREE.CylinderGeometry(0.34, 0.34, 0.26, 10)
  for (const [x, z] of [[-0.86, 1.32], [0.86, 1.32], [-0.86, -1.36], [0.86, -1.36]]) {
    const w = wheel()
    w.rotateZ(Math.PI / 2)
    w.translate(x, 0.34, z)
    parts.push(w)
  }

  const car = mergeGeometries(parts, false)

  // Cor por vértice a partir da normal: topo claro, lateral escura.
  const normal = car.attributes.normal
  const colors = new Float32Array(normal.count * 3)
  for (let i = 0; i < normal.count; i++) {
    const up = Math.max(0, normal.getY(i))
    const side = Math.abs(normal.getX(i))
    // Escurissimo de proposito. Na primeira tentativa isto valia ate 0.4 e,
    // convertido para sRGB na saida, os carros saiam cinza-claro contra uma
    // rua noturna — pareciam recortados e colados na cena.
    const v = 0.012 + up * 0.055 + side * 0.008
    colors[i * 3] = v
    colors[i * 3 + 1] = v * 0.94
    colors[i * 3 + 2] = v * 0.98
  }
  car.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return car
}

/** Desenha anos e fotos num atlas só: uma textura, uma draw call. */
async function buildAtlas(years, photos) {
  const items = years.length + photos.length
  const rows = Math.ceil(items / COLS)
  const canvas = document.createElement('canvas')
  canvas.width = COLS * CELL
  canvas.height = rows * CELL
  const g = canvas.getContext('2d')

  years.forEach((year, i) => {
    const cx = (i % COLS) * CELL
    const cy = Math.floor(i / COLS) * CELL
    g.save()
    g.translate(cx, cy)
    g.fillStyle = '#f5efe6'
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.font = `700 ${year.length > 4 ? 62 : 78}px "Space Grotesk", system-ui, sans-serif`
    g.fillText(year, CELL / 2, CELL / 2)
    g.restore()
  })

  await Promise.all(
    photos.map(
      (url, i) =>
        new Promise((resolve) => {
          const idx = years.length + i
          const img = new Image()
          img.onload = () => {
            const cx = (idx % COLS) * CELL
            const cy = Math.floor(idx / COLS) * CELL
            const s = Math.max(CELL / img.width, CELL / img.height)
            const w = img.width * s
            const h = img.height * s
            g.drawImage(img, cx + (CELL - w) / 2, cy + (CELL - h) / 2, w, h)
            resolve()
          }
          img.onerror = resolve
          img.src = url
        })
    )
  )

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, rows }
}

/**
 * Mapeia progresso de scroll (0-1) para distância percorrida, achatando a
 * curva perto de cada marco. É isto que faz a câmera desacelerar nos anos.
 */
function makeEasing(gates) {
  return (p) => {
    let slow = 0
    for (const g of gates) {
      const d = Math.abs(p - g)
      // Poço de desaceleração em torno do marco.
      slow += Math.exp(-(d * d) / 0.0016) * 0.6
    }
    return slow
  }
}

export async function createRoadTimeline(canvas, entries) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))

  const years = entries.map((e) => e.year)
  const photos = entries.flatMap((e) => e.photos)
  const { texture, rows } = await buildAtlas(years, photos)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400)
  camera.position.set(0, 1.55, 4)

  const light = new THREE.Color()
  const fog = new THREE.Color()

  // --- a estrada ------------------------------------------------------------
  const roadUniforms = {
    uLight: { value: new THREE.Color(0.75, 0.72, 0.8) },
    uFog: { value: new THREE.Color(0.02, 0.008, 0.012) },
    uLen: { value: ROAD_LEN },
  }
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_W, ROAD_LEN, 1, 1),
    new THREE.ShaderMaterial({
      vertexShader: ROAD_VERT,
      fragmentShader: ROAD_FRAG,
      uniforms: roadUniforms,
    })
  )
  road.rotation.x = -Math.PI / 2
  road.position.z = -ROAD_LEN / 2
  scene.add(road)

  // --- a cidade -------------------------------------------------------------
  // Silhueta urbana dos dois lados, recuando até a névoa. São caixas
  // instanciadas com janelas desenhadas no shader — nenhuma geometria extra
  // por janela, o que permite quase duzentos prédios numa draw call só.
  const CITY = 190
  const cityGeo = new THREE.InstancedBufferGeometry()
  const box = new THREE.BoxGeometry(1, 1, 1)
  cityGeo.index = box.index
  cityGeo.attributes.position = box.attributes.position
  cityGeo.attributes.normal = box.attributes.normal
  cityGeo.attributes.uv = box.attributes.uv
  cityGeo.instanceCount = CITY

  const cPos = new Float32Array(CITY * 3)
  const cScale = new Float32Array(CITY * 3)
  const cSeed = new Float32Array(CITY)

  for (let i = 0; i < CITY; i++) {
    const side = i % 2 ? 1 : -1
    // Duas fileiras por lado: a de trás mais alta e mais longe, o que dá
    // profundidade sem precisar de mais geometria.
    const row = Math.floor(i / 2) % 2
    const dist = ROAD_W / 2 + 7 + row * 13 + Math.random() * 5
    const h = (row ? 14 : 7) + Math.random() * (row ? 26 : 14)

    cPos[i * 3] = side * dist
    cPos[i * 3 + 1] = 0
    cPos[i * 3 + 2] = -8 - (i / CITY) * (ROAD_LEN - 30) + (Math.random() - 0.5) * 12

    cScale[i * 3] = 3.5 + Math.random() * 5
    cScale[i * 3 + 1] = h
    cScale[i * 3 + 2] = 3.5 + Math.random() * 6
    cSeed[i] = Math.random() * 100
  }

  cityGeo.setAttribute('aPos', new THREE.InstancedBufferAttribute(cPos, 3))
  cityGeo.setAttribute('aScale', new THREE.InstancedBufferAttribute(cScale, 3))
  cityGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(cSeed, 1))

  const city = new THREE.Mesh(
    cityGeo,
    new THREE.ShaderMaterial({
      vertexShader: CITY_VERT,
      fragmentShader: CITY_FRAG,
      uniforms: { uLight: roadUniforms.uLight, uFog: roadUniforms.uFog },
    })
  )
  city.frustumCulled = false
  scene.add(city)

  // --- postes ---------------------------------------------------------------
  // Só o halo, sem o mastro: a luz é o que se vê à noite, e billboards
  // aditivos custam muito menos que cilindros com material emissivo.
  const POLES = 46
  const glowGeo = new THREE.InstancedBufferGeometry()
  const glowQuad = new THREE.PlaneGeometry(1, 1)
  glowGeo.index = glowQuad.index
  glowGeo.attributes.position = glowQuad.attributes.position
  glowGeo.attributes.uv = glowQuad.attributes.uv
  glowGeo.instanceCount = POLES

  const gPos = new Float32Array(POLES * 3)
  const gSize = new Float32Array(POLES)
  for (let i = 0; i < POLES; i++) {
    const side = i % 2 ? 1 : -1
    gPos[i * 3] = side * (ROAD_W / 2 + 1.4)
    gPos[i * 3 + 1] = 5.2
    gPos[i * 3 + 2] = -10 - Math.floor(i / 2) * 17
    gSize[i] = 5 + Math.random() * 2.5
  }
  glowGeo.setAttribute('aPos', new THREE.InstancedBufferAttribute(gPos, 3))
  glowGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(gSize, 1))

  const glows = new THREE.Mesh(
    glowGeo,
    new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uLight: roadUniforms.uLight },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  glows.frustumCulled = false
  glows.renderOrder = 2
  scene.add(glows)

  // --- tráfego --------------------------------------------------------------
  // Carros modelados de verdade, instanciados numa malha só. As luzes
  // continuam sendo billboards aditivos por cima: geometria não brilha, e o
  // halo é o que faz o farol existir a distância.
  const CARS = 14
  const carGeo = buildCar()
  const carMesh = new THREE.InstancedMesh(
    carGeo,
    new THREE.ShaderMaterial({
      vertexShader: BODY_VERT,
      fragmentShader: BODY_FRAG,
      uniforms: { uLight: roadUniforms.uLight, uFog: roadUniforms.uFog },
      vertexColors: true,
    }),
    CARS
  )
  carMesh.frustumCulled = false
  scene.add(carMesh)

  const lanes = []
  for (let i = 0; i < CARS; i++) {
    const oncoming = i % 2 === 0
    lanes.push({
      x: (oncoming ? -1 : 1) * ROAD_W * 0.24,
      z: -(i / CARS) * ROAD_LEN,
      speed: (9 + Math.random() * 15) * (oncoming ? 1 : -1),
      oncoming,
    })
  }

  // Luzes: duas por carro, na frente ou atrás conforme o sentido.
  const LAMPS = CARS * 2
  const carLightGeo = new THREE.InstancedBufferGeometry()
  const carQuad = new THREE.PlaneGeometry(1, 1)
  carLightGeo.index = carQuad.index
  carLightGeo.attributes.position = carQuad.attributes.position
  carLightGeo.attributes.uv = carQuad.attributes.uv
  carLightGeo.instanceCount = LAMPS

  const lPos = new Float32Array(LAMPS * 3)
  const lSize = new Float32Array(LAMPS)
  const lSeed = new Float32Array(LAMPS)
  for (let i = 0; i < LAMPS; i++) {
    lSize[i] = lanes[Math.floor(i / 2)].oncoming ? 1.7 : 1.15
    lSeed[i] = lanes[Math.floor(i / 2)].oncoming ? 0.9 : 0.1
  }
  carLightGeo.setAttribute('aPos', new THREE.InstancedBufferAttribute(lPos, 3))
  carLightGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(lSize, 1))
  carLightGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(lSeed, 1))

  const carLights = new THREE.Mesh(
    carLightGeo,
    new THREE.ShaderMaterial({
      vertexShader: CAR_VERT,
      fragmentShader: CAR_FRAG,
      uniforms: {},
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  carLights.frustumCulled = false
  carLights.renderOrder = 3
  scene.add(carLights)

  const dummy = new THREE.Object3D()
  const posAttr = carLightGeo.getAttribute('aPos')

  // Move o trânsito. Quatorze matrizes por frame é barato, e ter as posições
  // na CPU é o que permite pendurar as luzes exatamente no bico de cada carro.
  const driveCars = (t) => {
    for (let i = 0; i < CARS; i++) {
      const lane = lanes[i]
      let z = lane.z + t * lane.speed
      z = ((z % ROAD_LEN) + ROAD_LEN) % ROAD_LEN - ROAD_LEN
      dummy.position.set(lane.x, 0, z)
      // A frente do modelo aponta para +Z. Quem vem na direcao da camera anda
      // para +Z e nao gira; quem se afasta e que precisa da meia volta.
      dummy.rotation.y = lane.oncoming ? 0 : Math.PI
      dummy.updateMatrix()
      carMesh.setMatrixAt(i, dummy.matrix)

      const nose = lane.oncoming ? z + 2.0 : z - 2.0
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k
        posAttr.array[j * 3] = lane.x + (k ? 0.62 : -0.62)
        posAttr.array[j * 3 + 1] = 0.72
        posAttr.array[j * 3 + 2] = nose
      }
    }
    carMesh.instanceMatrix.needsUpdate = true
    posAttr.needsUpdate = true
  }

  // --- anos e fotos ---------------------------------------------------------
  const marks = []
  entries.forEach((e, i) => {
    const z = -30 - i * ((ROAD_LEN - 70) / entries.length)
    // O ano deitado no asfalto.
    marks.push({ cell: i, pos: [0, 0.02, z], size: [3.6, 3.6], flat: 1 })
    // As fotos de pé nas margens, alternando os lados.
    e.photos.forEach((_, k) => {
      const cell = years.length + photos.indexOf(e.photos[k])
      const side = k % 2 ? 1 : -1
      marks.push({
        cell,
        // Maiores e mais perto do acostamento: na primeira calibragem elas
        // ficavam a 1,5 unidade de largura e o rosto era ilegível a essa
        // distância — viravam manchas na margem em vez de fotografias.
        pos: [side * (ROAD_W / 2 + 1.1), 2.6, z + (k - 0.5) * 9],
        size: [3.0, 4.0],
        flat: 0,
      })
    })
  })

  const count = marks.length
  const geometry = new THREE.InstancedBufferGeometry()
  const quad = new THREE.PlaneGeometry(1, 1)
  geometry.index = quad.index
  geometry.attributes.position = quad.attributes.position
  geometry.attributes.uv = quad.attributes.uv
  geometry.instanceCount = count

  const aPos = new Float32Array(count * 3)
  const aCell = new Float32Array(count * 2)
  const aSize = new Float32Array(count * 2)
  const aFlat = new Float32Array(count)

  marks.forEach((m, i) => {
    aPos.set(m.pos, i * 3)
    aCell[i * 2] = (m.cell % COLS) / COLS
    aCell[i * 2 + 1] = 1 - (Math.floor(m.cell / COLS) + 1) / rows
    aSize.set(m.size, i * 2)
    aFlat[i] = m.flat
  })

  geometry.setAttribute('aPos', new THREE.InstancedBufferAttribute(aPos, 3))
  geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(aCell, 2))
  geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(aSize, 2))
  geometry.setAttribute('aFlat', new THREE.InstancedBufferAttribute(aFlat, 1))

  const billUniforms = {
    uAtlas: { value: texture },
    uCellSize: { value: new THREE.Vector2(1 / COLS, 1 / rows) },
    uFog: roadUniforms.uFog,
    uLight: roadUniforms.uLight,
  }
  const bills = new THREE.Mesh(
    geometry,
    new THREE.ShaderMaterial({
      vertexShader: BILL_VERT,
      fragmentShader: BILL_FRAG,
      uniforms: billUniforms,
      transparent: true,
      depthWrite: false,
    })
  )
  bills.frustumCulled = false
  scene.add(bills)

  // Luz por era: fria no começo, dourada no meio, vinho e quase branca no fim.
  // A sequência é a que você descreveu — a luz conta a história junto.
  const LIGHTS = [
    new THREE.Color('#7d8fa8'),
    new THREE.Color('#c9964a'),
    new THREE.Color('#9a2135'),
    new THREE.Color('#c41e3a'),
    new THREE.Color('#e8ded0'),
  ]
  const FOGS = [
    new THREE.Color('#05070c'),
    new THREE.Color('#0c0703'),
    new THREE.Color('#0d0306'),
    new THREE.Color('#0a0204'),
    new THREE.Color('#0e0a0a'),
  ]

  const gates = entries.map((_, i) => (i + 0.5) / entries.length)
  const slowdown = makeEasing(gates)

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  // A cena deixa de ser puramente scrubada: tráfego e janelas correm no tempo
  // mesmo com o scroll parado. Só roda enquanto a seção está visível.
  const cityUniforms = { uTime: { value: 0 } }
  city.material.uniforms.uTime = cityUniforms.uTime

  let raf = 0
  let running = false
  let last = 0
  let clock = 0

  const render = () => renderer.render(scene, camera)

  const loop = (now) => {
    raf = requestAnimationFrame(loop)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    clock += dt
    cityUniforms.uTime.value = clock
    driveCars(clock)
    render()
  }

  // Integra a curva de desaceleração uma vez, para converter progresso em
  // distância sem recalcular a integral a cada frame de scroll.
  const STEPS = 600
  const table = new Float32Array(STEPS + 1)
  let acc = 0
  for (let i = 0; i <= STEPS; i++) {
    const p = i / STEPS
    acc += 1 / (1 + slowdown(p))
    table[i] = acc
  }
  for (let i = 0; i <= STEPS; i++) table[i] /= acc

  window.addEventListener('resize', () => {
    resize()
    render()
  })
  resize()

  return {
    start() {
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(loop)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    setProgress(p) {
      const t = Math.min(Math.max(p, 0), 1)
      const idx = Math.min(STEPS, Math.round(t * STEPS))
      const travelled = table[idx]

      camera.position.z = 4 - travelled * (ROAD_LEN - 40)
      // Leve balanço lateral: câmera de mão, não trilho de estúdio.
      camera.position.x = Math.sin(t * 9.2) * 0.35
      camera.rotation.y = Math.sin(t * 9.2 + 1.2) * 0.012

      // Interpola a luz entre as eras vizinhas.
      const f = t * (LIGHTS.length - 1)
      const i0 = Math.min(LIGHTS.length - 1, Math.floor(f))
      const i1 = Math.min(LIGHTS.length - 1, i0 + 1)
      const k = f - i0
      light.copy(LIGHTS[i0]).lerp(LIGHTS[i1], k)
      fog.copy(FOGS[i0]).lerp(FOGS[i1], k)
      roadUniforms.uLight.value.copy(light)
      roadUniforms.uFog.value.copy(fog)
      renderer.setClearColor(fog, 1)

      render()
      return { light: `#${light.getHexString()}`, index: i0 }
    },
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      carQuad.dispose()
      carGeo.dispose()
      carLightGeo.dispose()
      carMesh.material.dispose()
      carLights.material.dispose()
      quad.dispose()
      box.dispose()
      glowQuad.dispose()
      cityGeo.dispose()
      city.material.dispose()
      glowGeo.dispose()
      glows.material.dispose()
      geometry.dispose()
      road.geometry.dispose()
      road.material.dispose()
      bills.material.dispose()
      texture.dispose()
      renderer.dispose()
    },
  }
}
