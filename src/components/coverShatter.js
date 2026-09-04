import * as THREE from 'three'

/**
 * A capa do álbum estilhaça e os cacos remontam a frase.
 *
 * Três fases num único progresso de scroll (0→1):
 *   0.00–0.16  a capa inteira, câmera empurrando devagar
 *   0.16–0.54  explode: cada caco voa, gira e se afasta
 *   0.54–0.94  os mesmos cacos convergem para as posições que desenham
 *              "EU VENCI / O MUNDO" — as letras são feitas de pedaços da capa
 *
 * Tudo acontece no vertex shader, a partir de atributos por instância. Nenhum
 * cálculo por caco na CPU: mudar de fase é escrever um float num uniform, o que
 * é o que permite isto ser scrubado pelo scroll sem engasgar.
 */

const GRID = 72 // 5184 cacos — densidade é o que faz a frase ficar legível
const COVER = 2.7 // lado da capa em unidades de mundo

const VERT = /* glsl */ `
  attribute vec3 aHome;
  attribute vec2 aCell;
  attribute vec3 aBurst;
  attribute vec3 aTarget;
  attribute vec3 aSpin;
  attribute float aSeed;

  uniform float uProgress;
  uniform float uCell;
  uniform float uTextScale;

  varying vec2 vUv;
  varying float vForm;

  mat3 axisRot(vec3 axis, float angle) {
    float s = sin(angle);
    float c = cos(angle);
    float t = 1.0 - c;
    vec3 a = normalize(axis);
    return mat3(
      t * a.x * a.x + c,        t * a.x * a.y - s * a.z,  t * a.x * a.z + s * a.y,
      t * a.x * a.y + s * a.z,  t * a.y * a.y + c,        t * a.y * a.z - s * a.x,
      t * a.x * a.z - s * a.y,  t * a.y * a.z + s * a.x,  t * a.z * a.z + c
    );
  }

  void main() {
    // As duas fases se sobrepõem de propósito: os primeiros cacos já estão
    // sendo puxados para a frase enquanto os últimos ainda explodem. Sem essa
    // sobreposição a animação lê como dois movimentos colados.
    float burst = smoothstep(0.16, 0.56, uProgress);
    float form = smoothstep(0.52, 0.94, uProgress);

    // O atraso por caco é o que dá a sensação de enxame em vez de bloco.
    float lag = aSeed * 0.22;
    float b = clamp((burst - lag) / max(1.0 - lag, 0.001), 0.0, 1.0);
    float f = clamp((form - lag * 0.6) / max(1.0 - lag * 0.6, 0.001), 0.0, 1.0);

    vec3 pos = mix(aHome, aHome + aBurst, b);
    pos = mix(pos, aTarget * vec3(uTextScale, uTextScale, 1.0), f);

    // O tamanho do caco ao formar a frase é o parâmetro mais sensível da cena,
    // e erra para os dois lados: pequeno demais e a letra sai furada, virando
    // poeira; grande demais e os cacos transbordam o traço e preenchem a caixa
    // do texto, virando um bloco sólido.
    //
    // A conta: 5184 cacos precisam cobrir ~2,5 unidades² de glifo com folga.
    // Área por caco = (0.0375 * s)², e s = 0.72 dá ~1,5x de cobertura — o
    // suficiente para o traço fechar sem vazar para fora dele.
    float scale = mix(1.0, 0.72, f);

    // Gira só enquanto voa; para de girar ao assentar na frase.
    float spin = b * (1.0 - f) * 7.0 * (0.4 + aSeed);
    vec3 local = axisRot(aSpin, spin) * (position * scale);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos + local, 1.0);

    vUv = aCell + uv * uCell;
    vForm = f;
  }
`

const FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D uMap;
  varying vec2 vUv;
  varying float vForm;

  void main() {
    vec4 c = texture2D(uMap, vUv);
    // Ao formar a frase os cacos esquentam para o rubi da identidade — a capa
    // vira texto sem deixar de ser a capa.
    // A capa do EVOM é uma cena escura: sobre fundo preto os cacos sumiriam.
    // Ao formar a frase eles ganham piso de luminância no rubi da identidade,
    // preservando a textura da capa mas garantindo contraste de leitura.
    float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
    vec3 hot = mix(vec3(0.62, 0.09, 0.17), vec3(1.0, 0.86, 0.78), lum * 1.5);
    c.rgb = mix(c.rgb, hot, vForm * 0.9);
    gl_FragColor = c;
  }
`

/** Amostra pontos dentro do desenho do texto, via canvas 2D. */
function sampleText(lines, count) {
  const W = 1024
  const H = 512
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const g = canvas.getContext('2d', { willReadFrequently: true })
  g.fillStyle = '#fff'
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.font = '700 168px "Space Grotesk", system-ui, sans-serif'
  lines.forEach((line, i) => g.fillText(line, W / 2, H / 2 + (i - (lines.length - 1) / 2) * 186))

  const data = g.getImageData(0, 0, W, H).data
  const hits = []
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      if (data[(y * W + x) * 4 + 3] > 128) hits.push([x, y])
    }
  }
  if (!hits.length) return null

  // Escala de mundo: 7.2 de largura para o texto, contra 2.7 da capa — a frase
  // nasce bem maior que o disco que a formou.
  const out = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const [x, y] = hits[Math.floor((i / count) * hits.length)]
    out[i * 3] = (x / W - 0.5) * 6.0
    out[i * 3 + 1] = -(y / H - 0.5) * 3.0
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.12 // pouca profundidade: letra tem que ficar nítida
  }
  return out
}

export function createCoverShatter(canvas, coverUrl) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
  } catch {
    return null
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 1.75)
  renderer.setPixelRatio(dpr)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100)
  camera.position.z = 4.7

  const count = GRID * GRID
  const cell = COVER / GRID

  const geometry = new THREE.InstancedBufferGeometry()
  const quad = new THREE.PlaneGeometry(cell, cell)
  geometry.index = quad.index
  geometry.attributes.position = quad.attributes.position
  geometry.attributes.uv = quad.attributes.uv
  geometry.instanceCount = count

  const home = new Float32Array(count * 3)
  const cells = new Float32Array(count * 2)
  const burst = new Float32Array(count * 3)
  const spin = new Float32Array(count * 3)
  const seed = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    const cx = i % GRID
    const cy = Math.floor(i / GRID)
    home[i * 3] = (cx + 0.5) * cell - COVER / 2
    home[i * 3 + 1] = COVER / 2 - (cy + 0.5) * cell
    home[i * 3 + 2] = 0

    cells[i * 2] = cx / GRID
    cells[i * 2 + 1] = 1 - (cy + 1) / GRID

    // A explosão sai do centro: quanto mais longe do meio, mais longe voa.
    const dx = home[i * 3]
    const dy = home[i * 3 + 1]
    const len = Math.max(Math.hypot(dx, dy), 0.001)
    const push = 1.6 + Math.random() * 3.4
    burst[i * 3] = (dx / len) * push + (Math.random() - 0.5) * 1.4
    burst[i * 3 + 1] = (dy / len) * push + (Math.random() - 0.5) * 1.4
    burst[i * 3 + 2] = (Math.random() - 0.35) * 3.2

    spin[i * 3] = Math.random() - 0.5
    spin[i * 3 + 1] = Math.random() - 0.5
    spin[i * 3 + 2] = Math.random() - 0.5

    seed[i] = Math.random()
  }

  const targets = sampleText(['EU VENCI', 'O MUNDO'], count) || home.slice()

  geometry.setAttribute('aHome', new THREE.InstancedBufferAttribute(home, 3))
  geometry.setAttribute('aCell', new THREE.InstancedBufferAttribute(cells, 2))
  geometry.setAttribute('aBurst', new THREE.InstancedBufferAttribute(burst, 3))
  geometry.setAttribute('aTarget', new THREE.InstancedBufferAttribute(targets, 3))
  geometry.setAttribute('aSpin', new THREE.InstancedBufferAttribute(spin, 3))
  geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seed, 1))

  const texture = new THREE.TextureLoader().load(coverUrl)
  texture.colorSpace = THREE.SRGBColorSpace

  const uniforms = {
    uMap: { value: texture },
    uProgress: { value: 0 },
    uCell: { value: 1 / GRID },
    uTextScale: { value: 1 },
  }

  const material = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms,
    side: THREE.DoubleSide,
    transparent: true,
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

    // A frase precisa caber na largura visível. Numa tela vertical ela encolhe
    // em vez de sangrar pelas bordas.
    const visibleW = 2 * camera.position.z * Math.tan((camera.fov * Math.PI) / 360) * camera.aspect
    uniforms.uTextScale.value = Math.min(1, (visibleW * 0.9) / 6.0)
  }

  // Sem loop de animação. A cena só muda quando o scroll muda, então ela
  // renderiza dentro do setProgress. Um rAF permanente aqui foi exatamente o
  // que quebrou a versão anterior: o loop era desligado quando o ScrollTrigger
  // saía de ativo, e como o scrub continua caminhando depois disso, o último
  // frame desenhado ficava congelado no meio da explosão — a frase nunca
  // chegava a se formar na tela. Renderizar sob demanda também zera o custo de
  // GPU enquanto o usuário está em outro capítulo.
  const render = () => renderer.render(scene, camera)

  window.addEventListener('resize', () => {
    resize()
    render()
  })
  resize()

  return {
    setProgress(p) {
      uniforms.uProgress.value = p
      // A câmera empurra durante a explosão e recua ao ler a frase — é o que
      // faz parecer movimento de câmera e não de objeto.
      camera.position.z = 4.7 - Math.sin(Math.min(Math.max(p, 0), 1) * Math.PI) * 0.9
      render()
    },
    render,
    resize,
    dispose() {
      window.removeEventListener('resize', resize)
      quad.dispose()
      geometry.dispose()
      material.dispose()
      texture.dispose()
      renderer.dispose()
    },
  }
}
