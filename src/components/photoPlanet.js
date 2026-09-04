import * as THREE from 'three'

/**
 * O planeta feito de fotografias.
 *
 * Milhares de quads billboard distribuídos numa esfera; cada um exibe uma das
 * fotos do projeto. De longe lê como uma esfera de partículas — de perto se
 * percebe que cada ponto é uma foto do Veigh.
 *
 * Três fases num progresso de scroll:
 *   0.00–0.30  tudo colapsado num ponto:      SÃO PAULO
 *   0.30–0.62  o aglomerado se abre:          BRASIL
 *   0.62–1.00  esfera completa, girando:      MUNDO
 *
 * Detalhe que viabiliza a cena: as 23 fotos são desenhadas antes num único
 * atlas de canvas. Sem isso seriam 23 texturas e 23 draw calls; com o atlas é
 * uma textura só e uma chamada, e cada instância escolhe a sua célula por UV.
 */

const COUNT = 1600
const ATLAS_COLS = 5
const CELL_PX = 256

const VERT = /* glsl */ `
  attribute vec3 aSphere;
  attribute vec2 aCell;
  attribute float aSize;
  attribute float aSeed;

  uniform float uProgress;
  uniform float uCellSize;
  uniform float uSpin;

  varying vec2 vUv;
  varying float vFade;

  void main() {
    // Fase 1: tudo comprimido perto da origem. Fase 2/3: abre para a esfera.
    float open = smoothstep(0.12, 0.78, uProgress);
    vec3 p = mix(aSphere * 0.045, aSphere, open);

    // A esfera gira devagar depois de formada — o giro só entra quando já há
    // esfera, senão o aglomerado inicial tremeria sem motivo.
    float a = uSpin * smoothstep(0.3, 1.0, uProgress);
    float s = sin(a);
    float c = cos(a);
    p = vec3(p.x * c - p.z * s, p.y, p.x * s + p.z * c);

    // Billboard: o deslocamento do quad é somado em espaço de visão, então a
    // foto encara a câmera sempre, sem matriz de rotação por instância.
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float size = aSize * mix(0.35, 1.0, open);
    mv.xy += position.xy * size;

    gl_Position = projectionMatrix * mv;

    vUv = aCell + uv * uCellSize;
    // As de trás escurecem: é o que dá volume de esfera em vez de disco.
    vFade = clamp(0.35 + (mv.z + 6.0) * 0.16, 0.15, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uAtlas;
  varying vec2 vUv;
  varying float vFade;

  void main() {
    vec4 c = texture2D(uAtlas, vUv);
    // Puxa levemente para o vinho, para o planeta pertencer à paleta do site.
    c.rgb = mix(c.rgb, c.rgb * vec3(1.15, 0.72, 0.8), 0.35);
    gl_FragColor = vec4(c.rgb * vFade, 1.0);
  }
`

/** Desenha todas as fotos num canvas único e devolve a textura + nº de células. */
async function buildAtlas(urls) {
  const rows = Math.ceil(urls.length / ATLAS_COLS)
  const canvas = document.createElement('canvas')
  canvas.width = ATLAS_COLS * CELL_PX
  canvas.height = rows * CELL_PX
  const g = canvas.getContext('2d')
  g.fillStyle = '#120609'
  g.fillRect(0, 0, canvas.width, canvas.height)

  await Promise.all(
    urls.map(
      (url, i) =>
        new Promise((resolve) => {
          const img = new Image()
          img.crossOrigin = 'anonymous'
          img.onload = () => {
            const cx = (i % ATLAS_COLS) * CELL_PX
            const cy = Math.floor(i / ATLAS_COLS) * CELL_PX
            // cover dentro da célula quadrada
            const s = Math.max(CELL_PX / img.width, CELL_PX / img.height)
            const w = img.width * s
            const h = img.height * s
            g.drawImage(img, cx + (CELL_PX - w) / 2, cy + (CELL_PX - h) / 2, w, h)
            resolve()
          }
          img.onerror = resolve // célula fica no fundo escuro; a cena não quebra
          img.src = url
        })
    )
  )

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, rows }
}

export async function createPhotoPlanet(canvas, photoUrls) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch {
    return null
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))

  const { texture, rows } = await buildAtlas(photoUrls)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100)
  camera.position.z = 7.4

  const geometry = new THREE.InstancedBufferGeometry()
  const quad = new THREE.PlaneGeometry(1, 1)
  geometry.index = quad.index
  geometry.attributes.position = quad.attributes.position
  geometry.attributes.uv = quad.attributes.uv
  geometry.instanceCount = COUNT

  const sphere = new Float32Array(COUNT * 3)
  const cells = new Float32Array(COUNT * 2)
  const sizes = new Float32Array(COUNT)
  const seeds = new Float32Array(COUNT)

  // Distribuição de Fibonacci: pontos igualmente espaçados na esfera. Aleatório
  // puro deixaria manchas e buracos visíveis na silhueta.
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < COUNT; i++) {
    const y = 1 - (i / (COUNT - 1)) * 2
    const r = Math.sqrt(Math.max(0, 1 - y * y))
    const theta = golden * i
    const radius = 2.6

    sphere[i * 3] = Math.cos(theta) * r * radius
    sphere[i * 3 + 1] = y * radius
    sphere[i * 3 + 2] = Math.sin(theta) * r * radius

    const cell = i % photoUrls.length
    cells[i * 2] = (cell % ATLAS_COLS) / ATLAS_COLS
    cells[i * 2 + 1] = 1 - (Math.floor(cell / ATLAS_COLS) + 1) / rows

    sizes[i] = 0.09 + Math.random() * 0.13
    seeds[i] = Math.random()
  }

  geometry.setAttribute('aSphere', new THREE.InstancedBufferAttribute(sphere, 3))
  geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2))
  geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 1))
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1))

  const uniforms = {
    uAtlas: { value: texture },
    uProgress: { value: 0 },
    uCellSize: { value: new THREE.Vector2(1 / ATLAS_COLS, 1 / rows) },
    uSpin: { value: 0 },
  }

  // uCellSize é vec2 no JS mas o shader espera escalar por eixo; passar como
  // vec2 e multiplicar componente a componente evita distorcer células quando
  // o atlas não é quadrado.
  const material = new THREE.ShaderMaterial({
    vertexShader: VERT.replace('uniform float uCellSize;', 'uniform vec2 uCellSize;'),
    fragmentShader: FRAG,
    uniforms,
    transparent: false,
  })

  const mesh = new THREE.Mesh(geometry, material)
  mesh.frustumCulled = false
  scene.add(mesh)

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

  const render = () => renderer.render(scene, camera)

  // O planeta gira devagar mesmo parado: um globo imóvel lê como imagem.
  let raf = 0
  let running = false
  const loop = (t) => {
    raf = requestAnimationFrame(loop)
    uniforms.uSpin.value = t * 0.00008
    render()
  }

  window.addEventListener('resize', () => {
    resize()
    render()
  })
  resize()

  return {
    start() {
      if (running) return
      running = true
      raf = requestAnimationFrame(loop)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    setProgress(p) {
      uniforms.uProgress.value = p
      // Câmera recua conforme o mundo se abre: de perto em São Paulo, longe no
      // mundo inteiro.
      camera.position.z = 3.1 + Math.min(Math.max(p, 0), 1) * 4.6
      if (!running) render()
    },
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      quad.dispose()
      geometry.dispose()
      material.dispose()
      texture.dispose()
      renderer.dispose()
    },
  }
}
