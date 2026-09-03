import * as THREE from 'three'

/**
 * Fundo atmosférico da intro (Ato 2 em diante): névoa vinho/rubi em shader +
 * brasas finas subindo. Fica atrás de tudo, custo baixo de GPU: um fullscreen
 * quad, um sistema de pontos e nada de post-processing.
 *
 * Retorna null se o WebGL não estiver disponível — o componente cai no
 * gradiente CSS sem quebrar.
 */

const FOG_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // O quad já nasce em clip space: sempre preenche a tela, sem depender da câmera.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FOG_FRAG = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uProgress;
  uniform vec2 uRes;
  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = vec2(uv.x * (uRes.x / max(uRes.y, 1.0)), uv.y);
    p.y -= uProgress * 0.10; // parallax mínimo: a névoa "desce" conforme o scroll avança

    float t = uTime * 0.045;
    vec2 warp = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 5.2));
    float f = fbm(p * 2.1 + warp * 0.9 + vec2(0.0, -t * 1.4));

    vec3 deep = vec3(0.239, 0.043, 0.086);
    vec3 wine = vec3(0.431, 0.078, 0.137);
    vec3 lift = vec3(0.604, 0.129, 0.208);
    vec3 ember = vec3(0.788, 0.588, 0.294);

    float vig = smoothstep(1.15, 0.15, distance(uv, vec2(0.5, 0.46)));
    vec3 col = mix(deep, wine, vig);
    col = mix(col, lift, smoothstep(0.42, 0.95, f) * 0.75 * vig);
    col += ember * pow(smoothstep(0.62, 1.0, f), 3.0) * 0.10;
    col += (hash(uv * uRes + uTime) - 0.5) * 0.015; // dither: mata o banding do gradiente

    gl_FragColor = vec4(col, 1.0);
  }
`

const EMBER_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aSeed;
  attribute float aSpeed;

  uniform float uTime;
  uniform float uScale;
  uniform float uProgress;

  varying float vAlpha;
  varying float vSeed;

  void main() {
    vec3 pos = position;
    pos.y = fract((pos.y + 1.2) / 2.4 + uTime * aSpeed * 0.012) * 2.4 - 1.2;
    pos.x += sin(uTime * 0.25 * aSpeed + aSeed * 6.2831) * 0.035;
    pos.y -= uProgress * 0.12;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    gl_PointSize = aSize * uScale * (1.0 + pos.z);

    vAlpha = smoothstep(1.2, 0.8, abs(pos.y)) * (0.30 + 0.70 * aSeed);
    vSeed = aSeed;
  }
`

const EMBER_FRAG = /* glsl */ `
  precision mediump float;

  varying float vAlpha;
  varying float vSeed;

  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, r);
    a *= a;
    vec3 col = mix(vec3(0.77, 0.15, 0.24), vec3(0.91, 0.78, 0.49), vSeed);
    gl_FragColor = vec4(col, a * vAlpha);
  }
`

export function createIntroBackground(canvas) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    })
  } catch {
    return null
  }
  if (!renderer) return null

  const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
  renderer.setPixelRatio(dpr)

  const scene = new THREE.Scene()
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10)

  // --- névoa ---------------------------------------------------------------
  const fogUniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  }
  const fogGeometry = new THREE.PlaneGeometry(2, 2)
  const fogMaterial = new THREE.ShaderMaterial({
    vertexShader: FOG_VERT,
    fragmentShader: FOG_FRAG,
    uniforms: fogUniforms,
    depthTest: false,
    depthWrite: false,
  })
  const fog = new THREE.Mesh(fogGeometry, fogMaterial)
  fog.frustumCulled = false
  fog.renderOrder = 0
  scene.add(fog)

  // --- brasas --------------------------------------------------------------
  const count = window.innerWidth < 768 ? 180 : 380
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const seeds = new Float32Array(count)
  const speeds = new Float32Array(count)

  for (let i = 0; i < count; i++) {
    positions[i * 3] = Math.random() * 2.4 - 1.2
    positions[i * 3 + 1] = Math.random() * 2.4 - 1.2
    positions[i * 3 + 2] = Math.random() * 0.6 - 0.3
    sizes[i] = 0.8 + Math.random() * 2.2
    seeds[i] = Math.random()
    speeds[i] = 0.4 + Math.random() * 1.3
  }

  const emberGeometry = new THREE.BufferGeometry()
  emberGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  emberGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  emberGeometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  emberGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))

  const emberUniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uScale: { value: dpr * 1.6 },
  }
  const emberMaterial = new THREE.ShaderMaterial({
    vertexShader: EMBER_VERT,
    fragmentShader: EMBER_FRAG,
    uniforms: emberUniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  })
  const embers = new THREE.Points(emberGeometry, emberMaterial)
  embers.frustumCulled = false
  embers.renderOrder = 1
  scene.add(embers)

  // --- loop ----------------------------------------------------------------
  let raf = 0
  let running = false
  let last = 0
  let time = 0

  const resize = () => {
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    renderer.setSize(width, height, false)
    fogUniforms.uRes.value.set(width * dpr, height * dpr)
    emberUniforms.uScale.value = dpr * (width < 768 ? 1.1 : 1.6)
  }

  const frame = (now) => {
    raf = requestAnimationFrame(frame)
    // dt limitado: se a aba ficou em background, a cena não "salta" na volta
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    time += dt
    fogUniforms.uTime.value = time
    emberUniforms.uTime.value = time
    renderer.render(scene, camera)
  }

  const start = () => {
    if (running) return
    running = true
    last = performance.now()
    raf = requestAnimationFrame(frame)
  }

  const stop = () => {
    running = false
    cancelAnimationFrame(raf)
  }

  const onVisibility = () => (document.hidden ? stop() : start())
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('resize', resize)
  resize()

  return {
    start,
    stop,
    setProgress(value) {
      fogUniforms.uProgress.value = value
      emberUniforms.uProgress.value = value
    },
    resize,
    dispose() {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)
      fogGeometry.dispose()
      fogMaterial.dispose()
      emberGeometry.dispose()
      emberMaterial.dispose()
      renderer.dispose()
    },
  }
}
