import * as THREE from 'three'

/**
 * A plateia, vista do palco.
 *
 * Esta é a única cena do site em que o usuário está do lado de dentro. Todas
 * as outras o colocam olhando para alguma coisa; aqui ele está onde o artista
 * está, e o que se vê é a multidão de volta.
 *
 * Milhares de luzes de celular em pontos instanciados, balançando fora de
 * sincronia. Fora de sincronia é o ponto: multidão em uníssono lê como
 * animação, multidão em fases diferentes lê como gente. Cada luz tem a sua
 * fase, a sua amplitude e o seu período.
 *
 * A profundidade faz o trabalho pesado — perto as luzes são grandes, nítidas e
 * separadas; longe viram um cintilar contínuo. É a mesma coisa que faz uma
 * foto de show parecer uma foto de show.
 *
 * As fotografias ficam atrás da multidão, grandes, como telão.
 */

const LIGHTS = 2600

const CROWD_VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute float aSize;
  attribute float aSeed;
  attribute float aPhase;

  uniform float uTime;
  uniform float uReveal;
  uniform float uScale;

  varying float vSeed;
  varying float vFade;

  void main() {
    vec3 p = aPos;

    // Balanço: cada braço tem período e amplitude próprios. O termo em x é
    // maior que o em y porque braço levantado oscila mais de lado.
    float t = uTime * (0.5 + aSeed * 0.7) + aPhase;
    p.x += sin(t) * (0.22 + aSeed * 0.34);
    p.y += cos(t * 1.3) * (0.06 + aSeed * 0.1);

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float dist = -mv.z;

    gl_Position = projectionMatrix * mv;
    // Tamanho em pixels cai com a distância — é isso que separa a primeira
    // fila do fundo do ginásio.
    gl_PointSize = (aSize * uScale) / max(dist, 1.0);

    // As luzes acendem em ondas conforme o scroll avança, não todas de uma vez:
    // a plateia levanta o celular aos poucos, como acontece de verdade.
    float turn = smoothstep(aSeed * 0.85, aSeed * 0.85 + 0.2, uReveal);
    // As de trás somem na fumaça.
    vFade = turn * (1.0 - smoothstep(26.0, 58.0, dist));
    vSeed = aSeed;
  }
`

const CROWD_FRAG = /* glsl */ `
  precision highp float;
  varying float vSeed;
  varying float vFade;

  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    // Núcleo duro com halo largo: tela de celular a distância é um ponto
    // saturado dentro de um brilho difuso.
    float core = pow(max(0.0, 1.0 - r * 1.9), 6.0);
    float halo = pow(max(0.0, 1.0 - r), 2.2) * 0.5;
    float a = (core + halo) * vFade;
    if (a < 0.004) discard;

    // Telas variam de temperatura: umas frias, umas quentes.
    vec3 col = mix(vec3(0.86, 0.9, 1.0), vec3(1.0, 0.88, 0.7), vSeed);
    gl_FragColor = vec4(col, a);
  }
`

const PANEL_VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute vec2 aCell;
  attribute vec2 aSize;
  uniform vec2 uCellSize;
  varying vec2 vUv;
  void main() {
    vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
    mv.xy += position.xy * aSize;
    gl_Position = projectionMatrix * mv;
    vUv = aCell + uv * uCellSize;
  }
`

const PANEL_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uAtlas;
  uniform float uReveal;
  varying vec2 vUv;
  void main() {
    vec4 c = texture2D(uAtlas, vUv);
    // O telão entra antes da plateia acender: primeiro a imagem, depois as
    // luzes subindo na frente dela.
    float show = smoothstep(0.0, 0.34, uReveal);
    gl_FragColor = vec4(c.rgb * (0.35 + show * 0.65), show);
  }
`

const COLS = 3
const CELL = 512

async function buildAtlas(urls) {
  const rows = Math.ceil(urls.length / COLS)
  const canvas = document.createElement('canvas')
  canvas.width = COLS * CELL
  canvas.height = rows * CELL
  const g = canvas.getContext('2d')
  g.fillStyle = '#0a0305'
  g.fillRect(0, 0, canvas.width, canvas.height)

  await Promise.all(
    urls.map(
      (url, i) =>
        new Promise((resolve) => {
          const img = new Image()
          img.onload = () => {
            const cx = (i % COLS) * CELL
            const cy = Math.floor(i / COLS) * CELL
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

export async function createCrowd(canvas, photoUrls) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
  } catch {
    return null
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(dpr)

  const { texture, rows } = await buildAtlas(photoUrls)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 200)
  // A câmera fica alta e olhando de leve para baixo: é a altura de quem está
  // no palco olhando a plateia, não a de quem está no meio dela.
  // Perto e um pouco acima da primeira fila, olhando de leve para baixo.
  // Na primeira calibragem a câmera estava a 6 unidades e o campo ia até -54:
  // a plateia inteira cabia numa faixa fina no meio da tela, porque a extensão
  // vertical de uma multidão na tela vem da PERSPECTIVA, e a perspectiva só
  // abre quando as primeiras fileiras estão realmente perto.
  camera.position.set(0, 2.1, 1.2)
  camera.rotation.x = -0.11

  // ---- a multidão ---------------------------------------------------------
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(LIGHTS * 3)
  const size = new Float32Array(LIGHTS)
  const seed = new Float32Array(LIGHTS)
  const phase = new Float32Array(LIGHTS)

  for (let i = 0; i < LIGHTS; i++) {
    // Distribuição em cunha: estreita perto do palco e abrindo ao fundo, que é
    // o formato real de uma plateia vista de cima do palco.
    // Expoente baixo concentra gente perto da câmera, que é onde a
    // perspectiva trabalha. Distribuição uniforme joga quase tudo no fundo.
    const depth = Math.pow(Math.random(), 0.5)
    const z = -0.6 - depth * 46
    const spread = 9 + depth * 46

    pos[i * 3] = (Math.random() - 0.5) * spread
    // Alturas bem variadas: braço esticado, celular no peito, ombro de quem
    // está atrás. É a variação que impede a fileira de virar uma linha.
    pos[i * 3 + 1] = 0.25 + Math.random() * 2.3 - depth * 0.35
    pos[i * 3 + 2] = z

    size[i] = 150 + Math.random() * 230
    seed[i] = Math.random()
    phase[i] = Math.random() * Math.PI * 2
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aPos', new THREE.BufferAttribute(pos, 3))
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
  geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))

  const crowdUniforms = {
    uTime: { value: 0 },
    uReveal: { value: 0 },
    uScale: { value: dpr },
  }

  const crowd = new THREE.Points(
    geo,
    new THREE.ShaderMaterial({
      vertexShader: CROWD_VERT,
      fragmentShader: CROWD_FRAG,
      uniforms: crowdUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  )
  crowd.frustumCulled = false
  scene.add(crowd)

  // ---- o telão ------------------------------------------------------------
  const panelGeo = new THREE.InstancedBufferGeometry()
  const quad = new THREE.PlaneGeometry(1, 1)
  panelGeo.index = quad.index
  panelGeo.attributes.position = quad.attributes.position
  panelGeo.attributes.uv = quad.attributes.uv
  panelGeo.instanceCount = photoUrls.length

  const pPos = new Float32Array(photoUrls.length * 3)
  const pCell = new Float32Array(photoUrls.length * 2)
  const pSize = new Float32Array(photoUrls.length * 2)

  for (let i = 0; i < photoUrls.length; i++) {
    // Telão de verdade: painéis grandes, altos e alinhados atrás da multidão.
    // A 54 unidades e com 10 de altura eles ocupavam 15% da tela e liam como
    // miniaturas — a foto de show precisa dominar o fundo.
    const spanX = ((i - (photoUrls.length - 1) / 2) / (photoUrls.length - 1)) * 44
    pPos[i * 3] = spanX
    pPos[i * 3 + 1] = 9.5
    pPos[i * 3 + 2] = -40
    pCell[i * 2] = (i % COLS) / COLS
    pCell[i * 2 + 1] = 1 - (Math.floor(i / COLS) + 1) / rows
    pSize[i * 2] = 13
    pSize[i * 2 + 1] = 17
  }

  panelGeo.setAttribute('aPos', new THREE.InstancedBufferAttribute(pPos, 3))
  panelGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(pCell, 2))
  panelGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(pSize, 2))

  const panelUniforms = {
    uAtlas: { value: texture },
    uCellSize: { value: new THREE.Vector2(1 / COLS, 1 / rows) },
    uReveal: { value: 0 },
  }

  const panels = new THREE.Mesh(
    panelGeo,
    new THREE.ShaderMaterial({
      vertexShader: PANEL_VERT,
      fragmentShader: PANEL_FRAG,
      uniforms: panelUniforms,
      transparent: true,
      depthWrite: false,
    })
  )
  panels.frustumCulled = false
  scene.add(panels)

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    crowdUniforms.uScale.value = dpr * (h / 900)
  }

  let raf = 0
  let running = false
  let last = 0
  let clock = 0

  const frame = (now) => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    clock += dt
    crowdUniforms.uTime.value = clock
    renderer.render(scene, camera)
  }

  window.addEventListener('resize', resize)
  resize()
  renderer.render(scene, camera)

  return {
    start() {
      if (running) return
      running = true
      last = performance.now()
      raf = requestAnimationFrame(frame)
    },
    stop() {
      running = false
      cancelAnimationFrame(raf)
    },
    setProgress(p) {
      const t = Math.min(Math.max(p, 0), 1)
      crowdUniforms.uReveal.value = t
      panelUniforms.uReveal.value = t
      // A câmera avança de leve para dentro da plateia.
      camera.position.z = 1.2 - t * 2.2
      if (!running) renderer.render(scene, camera)
    },
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      quad.dispose()
      geo.dispose()
      panelGeo.dispose()
      crowd.material.dispose()
      panels.material.dispose()
      texture.dispose()
      renderer.dispose()
    },
  }
}
