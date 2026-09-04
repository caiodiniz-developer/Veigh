import * as THREE from 'three'

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

  const render = () => renderer.render(scene, camera)

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
      window.removeEventListener('resize', resize)
      quad.dispose()
      geometry.dispose()
      road.geometry.dispose()
      road.material.dispose()
      bills.material.dispose()
      texture.dispose()
      renderer.dispose()
    },
  }
}
