import * as THREE from 'three'

/**
 * Um céu construído em shader — não é o vídeo da hero reaproveitado.
 *
 * O clipe da intro pertence à intro; usá-lo de novo aqui roubava a cena de
 * abertura e prendia esta seção a um arquivo de 11 MB. Este céu é gerado em
 * código: nuvens em fbm com domain warping, sol com bloom, raios crepusculares
 * saindo dele e uma deriva lenta. Pesa alguns kilobytes, roda em qualquer
 * resolução sem perder nitidez e responde ao scroll.
 *
 * Tudo mora dentro do canvas da seção. Nada de position: fixed — foi
 * exatamente o que fez a versão anterior vazar para a página inteira.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
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
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Espaço corrigido por aspecto: sem isso as nuvens esticam em tela larga.
    vec2 p = vec2((vUv.x - 0.5) * (uRes.x / max(uRes.y, 1.0)), vUv.y - 0.5);

    // O sol sobe um pouco conforme a seção avança — o scroll move a luz.
    vec2 sun = vec2(0.0, 0.16 + uProgress * 0.12);
    float d = length(p - sun);

    // Gradiente base: âmbar nas bordas, creme junto ao sol.
    vec3 amber = vec3(0.78, 0.44, 0.24);
    vec3 gold = vec3(0.96, 0.76, 0.49);
    vec3 core = vec3(1.0, 0.96, 0.89);
    vec3 sky = mix(amber, gold, smoothstep(1.15, 0.28, d));
    sky = mix(sky, core, smoothstep(0.5, 0.0, d));

    // Nuvens: fbm com domain warping, que é o que evita o padrão repetido
    // e dá volume de cúmulo em vez de mancha.
    float t = uTime * 0.014;
    vec2 q = p * 2.1 + vec2(t, -t * 0.35);
    float warp = fbm(q * 0.6 + t * 1.6);
    float f = fbm(q + warp * 0.9);

    float cloud = smoothstep(0.40, 0.74, f);
    // Contraluz: a nuvem é escura longe do sol e incandescente na borda dele,
    // que é o que faz o céu ler como final de tarde e não como fumaça.
    float rim = smoothstep(0.85, 0.28, d);
    vec3 shade = mix(vec3(0.42, 0.24, 0.22), vec3(1.0, 0.93, 0.80), rim);
    sky = mix(sky, shade, cloud * 0.86);

    // Raios crepusculares: modulados pelo ângulo em torno do sol e cortados
    // pela distância, senão viram listras cobrindo a tela toda.
    vec2 rel = p - sun;
    float ang = atan(rel.y, rel.x);
    float rays = fbm(vec2(ang * 3.2, uTime * 0.04));
    rays = smoothstep(0.44, 0.92, rays) * smoothstep(1.05, 0.12, d);
    sky += vec3(1.0, 0.88, 0.70) * rays * 0.20;

    // Bloom do sol por cima de tudo.
    sky += vec3(1.0, 0.95, 0.86) * pow(max(0.0, 1.0 - d * 1.45), 4.0) * 0.55;

    // Dither: mata o banding, que num céu de gradiente largo é inevitável.
    sky += (hash(vUv * uRes + uTime) - 0.5) * 0.016;

    gl_FragColor = vec4(sky, 1.0);
  }
`

export function createSky(canvas) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
  } catch {
    return null
  }
  // Céu difuso não precisa de densidade: 1.0 economiza metade dos pixels do
  // fragment shader sem diferença visível numa imagem sem bordas duras.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1))

  const scene = new THREE.Scene()
  const camera = new THREE.Camera()

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  }

  const quad = new THREE.PlaneGeometry(2, 2)
  const material = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms })
  const mesh = new THREE.Mesh(quad, material)
  mesh.frustumCulled = false
  scene.add(mesh)

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    uniforms.uRes.value.set(w, h)
  }

  let raf = 0
  let running = false
  let last = 0
  let time = 0

  const frame = (now) => {
    raf = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    time += dt
    uniforms.uTime.value = time
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
      uniforms.uProgress.value = p
    },
    dispose() {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      quad.dispose()
      material.dispose()
      renderer.dispose()
    },
  }
}
