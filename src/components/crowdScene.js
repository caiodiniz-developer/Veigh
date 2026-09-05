import * as THREE from 'three'

/**
 * A plateia, agora vista DE DENTRO dela.
 *
 * A câmera estava no palco olhando para a multidão. Para o artista aparecer em
 * cima do palco, ela precisa estar do outro lado — no meio do público, olhando
 * para a frente. As luzes de celular deixam de ser o assunto e viram primeiro
 * plano: grandes, desfocadas e recortadas pela borda de baixo, como numa foto
 * feita do meio da pista.
 *
 * Fora de sincronia continua sendo o ponto: cada luz tem fase, amplitude e
 * período próprios. Multidão em uníssono lê como animação; em fases
 * diferentes, lê como gente.
 *
 * O palco em si não é WebGL — é DOM, atrás deste canvas. Separar as camadas é
 * o que permite a fotografia dele ficar nítida e recortada enquanto a plateia
 * na frente fica fora de foco.
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
    vFade = turn * (1.0 - smoothstep(13.0, 26.0, dist));
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

export async function createCrowd(canvas) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true })
  } catch {
    return null
  }
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(dpr)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 200)
  // No meio do público, na altura de quem está de pé, olhando levemente para
  // cima em direção ao palco. Olhar para cima é o que empurra a multidão para
  // a faixa de baixo do quadro e abre o topo para o palco.
  camera.position.set(0, 1.62, 0)
  // Mais inclinada para cima: a 0.07 a multidão subia até o meio do quadro e
  // cobria o tampo do palco. Olhar mais para cima empurra o público para a
  // faixa de baixo e libera o palco inteiro.
  camera.rotation.x = 0.13

  // ---- a multidão ---------------------------------------------------------
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(LIGHTS * 3)
  const size = new Float32Array(LIGHTS)
  const seed = new Float32Array(LIGHTS)
  const phase = new Float32Array(LIGHTS)

  for (let i = 0; i < LIGHTS; i++) {
    // Distribuição em cunha: estreita perto do palco e abrindo ao fundo, que é
    // o formato real de uma plateia vista de cima do palco.
    // Tudo perto: a plateia agora é primeiro plano, não paisagem. O campo
    // curto é o que deixa as luzes grandes e desfocadas na borda de baixo.
    const depth = Math.pow(Math.random(), 0.62)
    const z = -0.4 - depth * 22
    const spread = 7 + depth * 30

    pos[i * 3] = (Math.random() - 0.5) * spread
    // Abaixo da linha dos olhos: celular erguido chega no máximo à altura da
    // cabeça de quem segura, e é isso que mantém o topo do quadro livre.
    // Teto mais baixo pelo mesmo motivo: braço erguido não passa da cabeça,
    // e o que passava estava invadindo o praticável.
    pos[i * 3 + 1] = 0.05 + Math.random() * 1.05 - depth * 0.12
    pos[i * 3 + 2] = z

    size[i] = 130 + Math.random() * 210
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

  // O telão saiu. Quem ocupa o fundo agora é o palco, montado em DOM atrás
  // deste canvas — as fotografias de show voltaram para lá, como painéis de
  // fundo de palco, onde ficam nítidas em vez de recortadas por um atlas.

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
      // A câmera avança de leve para dentro da plateia.
      camera.position.z = 0.4 - t * 1.1
      if (!running) renderer.render(scene, camera)
    },
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)

      geo.dispose()
      crowd.material.dispose()
      renderer.dispose()
    },
  }
}
