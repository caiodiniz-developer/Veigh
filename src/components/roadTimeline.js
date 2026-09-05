import * as THREE from 'three'
import gsap from 'gsap'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * A linha do tempo como estrada — agora com cenário modelado.
 *
 * A versão anterior era inteiramente procedural: prédios eram caixas com
 * janelas desenhadas no shader e os carros eram meia dúzia de primitivas
 * fundidas. Funcionava como silhueta e nunca como lugar. Aqui a cidade e os
 * carros são modelos de verdade, e nas margens estão os recortes do artista em
 * corpo inteiro, dois por era, na altura em que a câmera passa.
 *
 * O que sobreviveu da versão anterior é o que não era substituível por asset:
 * o céu de fim de tarde, o asfalto, os halos dos postes, os anos pintados no
 * chão e — principalmente — a curva de desaceleração. Ela é a peça central:
 * o scroll não mapeia linearmente para a posição da câmera, e perto de cada
 * ano a curva achata, então a mesma rolagem avança bem menos estrada. É o que
 * produz a sensação de documentário: o tempo passa mais devagar nos
 * acontecimentos.
 *
 * Sobre custo: os dois modelos somam quase meio milhão de triângulos (o carro
 * sozinho tem 414 mil). Por isso nada aqui é clonado como objeto — cada malha
 * do modelo vira UM InstancedMesh, e as malhas que dividem material são
 * fundidas antes. É a diferença entre 104 desenhos por carro e 26 desenhos
 * para todos eles.
 */

const ROAD_W = 9
const ROAD_LEN = 420
const CELL = 256
const COLS = 6

// Onde a névoa engole a cena. Amarra o shader do asfalto, o fog dos modelos e
// o far da câmera: se os três discordarem, aparece a borda do mundo.
const FOG_NEAR = 34
const FOG_FAR = 195

const SKY_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

const SKY_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uLight;
  uniform vec3 uFog;
  uniform float uTime;
  uniform vec2 uRes;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 p = vec2((vUv.x - 0.5) * (uRes.x / max(uRes.y, 1.0)), vUv.y);

    // A LINHA DO HORIZONTE.
    //
    // Na primeira versão o céu era um degradê da base para o topo, e o clarão
    // caía no rodapé da tela: as laterais fora do asfalto viravam chão âmbar,
    // como se a rua flutuasse sobre luz. A câmera olha na horizontal, então o
    // horizonte fica na metade da tela — abaixo dele é terra, não céu.
    const float HORIZON = 0.5;
    float above = smoothstep(HORIZON - 0.015, HORIZON + 0.015, vUv.y);
    float up = clamp((vUv.y - HORIZON) / (1.0 - HORIZON), 0.0, 1.0);

    // Céu: incandescente na linha, escurecendo para o alto. Fim de tarde, que
    // é o que deixa a cena clara sem apagar as janelas acesas da cidade.
    vec3 dusk = vec3(0.055, 0.045, 0.085) + uFog * 1.2;
    vec3 glow = uLight * 1.5;
    vec3 sky = mix(glow, dusk, pow(up, 0.62));

    // Nuvens em faixa, achatadas na vertical e arrastando devagar: nuvem de
    // horizonte é banda, não bola.
    vec2 q = vec2(p.x * 0.9 + uTime * 0.006, vUv.y * 4.2);
    float cloud = fbm(q + fbm(q * 0.6) * 0.6);
    cloud *= smoothstep(0.42, 0.0, up);
    sky = mix(sky, glow * 1.3, smoothstep(0.44, 0.8, cloud) * 0.5);

    // Terra: escura, com só um resto do clarão junto à linha.
    vec3 ground = mix(uFog * 0.9, uFog * 0.35, smoothstep(0.0, 0.42, HORIZON - vUv.y));

    // Estrelas na parte alta, onde o céu já escureceu o bastante para elas
    // existirem. Aparecem só acima do clarão do horizonte, que é onde estariam
    // num fim de tarde de verdade.
    vec2 sp = floor(vUv * uRes / 2.6);
    float star = step(0.9972, hash(sp));
    star *= smoothstep(0.25, 0.85, up);
    star *= 0.55 + 0.45 * sin(uTime * 1.7 + hash(sp) * 40.0);
    sky += vec3(star * 0.85);

    vec3 col = mix(ground, sky, above);
    col += (hash(vUv * uRes) - 0.5) * 0.012;
    gl_FragColor = vec4(col, 1.0);
  }
`

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
  uniform float uNear;
  uniform float uFar;
  varying vec2 vUv;
  varying float vDepth;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    // Asfalto: escuro com grão fino, senão a estrada lê como plástico.
    float grain = hash(floor(vUv * vec2(600.0, 3000.0)));
    vec3 road = vec3(0.045, 0.028, 0.034) + grain * 0.03;

    // ASFALTO MOLHADO.
    //
    // O que faltava na rua não era detalhe, era reflexo. Um asfalto seco à
    // noite é uma faixa preta; um asfalto úmido devolve o clarão do horizonte
    // em ângulo rasante, e é por isso que toda fotografia noturna de rua que
    // vale alguma coisa foi feita depois da chuva.
    //
    // Não há reflexão de verdade aqui — não existe cena para refletir num
    // plano. O que existe é a lei que a governa: quanto mais rasante o olhar,
    // mais a superfície devolve. vDepth é o proxy do ângulo, porque a câmera
    // está baixa e olhando na horizontal: longe é rasante, perto é de cima.
    float rasante = smoothstep(12.0, 90.0, vDepth);

    // Poças em manchas largas ao longo da pista, não uniformes — água parada
    // não cobre asfalto por igual.
    float pocas = 0.45 + 0.55 * hash(floor(vec2(vUv.x * 7.0, vUv.y * uLen * 0.06)));
    float molhado = rasante * pocas;
    road += uLight * molhado * 0.85;

    // Rastros verticais: a luz refletida na água escorre no sentido da rua.
    float rastro = hash(floor(vec2(vUv.x * 140.0, 0.0)));
    road += uLight * molhado * rastro * 0.42;

    // Faixa central tracejada. O traço vive no espaço do plano, então fica
    // parado no mundo e é a câmera que passa por ele.
    float dash = step(0.55, fract(vUv.y * uLen * 0.09));
    float center = smoothstep(0.012, 0.006, abs(vUv.x - 0.5));
    road = mix(road, uLight * 0.85, center * dash * 0.7);

    // Bordas iluminadas: é o que dá direção e velocidade à estrada.
    float edge = smoothstep(0.035, 0.0, abs(abs(vUv.x - 0.5) - 0.47));
    road = mix(road, uLight, edge * 0.55);

    // Névoa por distância, na MESMA faixa dos modelos: asfalto sumindo antes
    // ou depois dos prédios denuncia as duas camadas como coisas separadas.
    float fog = smoothstep(uNear, uFar, vDepth);
    gl_FragColor = vec4(mix(road, uFog, fog), 1.0);
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
    a *= 1.0 - smoothstep(30.0, 175.0, vDepth);
    gl_FragColor = vec4(uLight * a, a);
  }
`

const CAR_VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute float aSize;
  attribute float aSeed;
  varying vec2 vUv;
  varying float vSeed;
  varying float vDepth;
  void main() {
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
  varying float vSeed;
  varying float vDepth;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 3.0);
    // Faróis brancos vêm na direção da câmera; lanternas vermelhas se afastam.
    vec3 c = mix(vec3(0.85, 0.12, 0.1), vec3(1.0, 0.96, 0.88), step(0.5, vSeed));
    a *= 1.0 - smoothstep(40.0, 200.0, vDepth);
    gl_FragColor = vec4(c * a, a);
  }
`

const DUST_VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute float aSeed;
  uniform float uTime;
  uniform float uCamZ;
  varying float vA;
  varying float vDepth;

  void main() {
    // A poeira vive num bloco que ACOMPANHA a câmera. Espalhar partículas
    // pelos 420 de estrada exigiria dezenas de milhares delas para a densidade
    // aparecer perto; num bloco que anda junto, oitocentas bastam — e o
    // envolvimento de fract() reposiciona cada uma no fim do bloco assim que
    // ela sai por trás, então nunca falta nem sobra.
    vec3 p = aPos;
    p.y += sin(uTime * 0.35 + aSeed * 12.0) * 0.9;
    p.x += cos(uTime * 0.27 + aSeed * 9.0) * 0.7;
    float z = uCamZ - 4.0 - mod(p.z + uTime * 0.9, 60.0);

    vec4 mv = modelViewMatrix * vec4(p.x, p.y, z, 1.0);
    vDepth = -mv.z;
    // Ponto do tamanho de um grão, encolhendo com a distância como qualquer
    // coisa que tenha volume.
    gl_PointSize = (26.0 + aSeed * 22.0) / max(vDepth, 1.0);
    vA = 0.35 + 0.65 * sin(uTime * 1.9 + aSeed * 30.0);
    gl_Position = projectionMatrix * mv;
  }
`

const DUST_FRAG = /* glsl */ `
  precision highp float;
  uniform vec3 uLight;
  varying float vA;
  varying float vDepth;
  void main() {
    // Grão redondo e sem borda dura: partícula quadrada entrega o point sprite.
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 2.0) * vA;
    // Some junto com o resto da cena e também quando está perto demais, para
    // nenhuma partícula estourar no rosto da câmera.
    a *= smoothstep(1.5, 6.0, vDepth) * (1.0 - smoothstep(28.0, 62.0, vDepth));
    gl_FragColor = vec4(uLight * 2.2 * a, a);
  }
`

const YEAR_VERT = /* glsl */ `
  attribute vec3 aPos;
  attribute vec2 aCell;
  attribute vec2 aSize;
  uniform vec2 uCellSize;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    // Pintado no chão: o quad fica deitado, não encara a câmera.
    vec3 local = vec3(position.x * aSize.x, 0.0, -position.y * aSize.y);
    vec4 mv = modelViewMatrix * vec4(aPos + local, 1.0);
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
    vUv = aCell + uv * uCellSize;
  }
`

const YEAR_FRAG = /* glsl */ `
  precision highp float;
  uniform sampler2D uAtlas;
  uniform vec3 uFog;
  uniform vec3 uLight;
  varying vec2 vUv;
  varying float vDepth;
  void main() {
    vec4 c = texture2D(uAtlas, vUv);
    if (c.a < 0.04) discard;
    c.rgb = mix(c.rgb, c.rgb * uLight * 1.9, 0.35) * 1.6;
    float fog = smoothstep(50.0, 210.0, vDepth);
    gl_FragColor = vec4(mix(c.rgb, uFog, fog), c.a);
  }
`

/* ========================================================== modelos 3D === */

/**
 * Carrega um .glb e devolve as malhas já normalizadas e fundidas por material.
 *
 * Três coisas acontecem aqui, e nenhuma é opcional:
 *
 * 1. NORMALIZAÇÃO. Modelo de banco vem em escala e origem arbitrárias — um
 *    deles nasce com 400 unidades de altura e o pivô no meio do volume. A cena
 *    trabalha em metros com o chão em y=0, então cada modelo é reescalado pela
 *    altura pedida, centrado no plano horizontal e apoiado na base.
 *
 * 2. ORIENTAÇÃO. Não dá para supor para que lado o modelo aponta. O eixo
 *    horizontal mais comprido de um carro é o comprimento dele, então medir a
 *    caixa e girar 90° quando o comprimento está em X alinha qualquer modelo à
 *    estrada sem número mágico.
 *
 * 3. FUSÃO POR MATERIAL. O carro tem 104 malhas separadas. Instanciar cada uma
 *    são 104 desenhos por frame; fundir as que dividem material derruba para
 *    26. A matriz de cada malha dentro do modelo é assada na geometria antes
 *    da fusão — depois disso não existe mais hierarquia para preservar.
 */
async function carregarModelo(url, { altura, alinharZ = false }) {
  const gltf = await new GLTFLoader().loadAsync(url)
  const raiz = gltf.scene
  raiz.updateWorldMatrix(true, true)

  const caixa = new THREE.Box3().setFromObject(raiz)
  const tam = caixa.getSize(new THREE.Vector3())
  const centro = caixa.getCenter(new THREE.Vector3())
  if (!(tam.y > 0)) return null

  const escala = altura / tam.y
  const girar = alinharZ && tam.x > tam.z

  // Ordem: primeiro traz a base para a origem, depois escala, depois gira.
  const normalizar = new THREE.Matrix4()
    .makeRotationY(girar ? Math.PI / 2 : 0)
    .multiply(new THREE.Matrix4().makeScale(escala, escala, escala))
    .multiply(new THREE.Matrix4().makeTranslation(-centro.x, -caixa.min.y, -centro.z))

  // Agrupa por material. Fundir exige que os atributos batam exatamente, então
  // os extras (tangent, uv1, color) saem: a cena não usa nenhum deles, e um
  // atributo presente em metade das malhas faz mergeGeometries devolver null.
  const grupos = new Map()
  raiz.traverse((o) => {
    if (!o.isMesh || !o.geometry) return
    const g = o.geometry.clone()
    for (const nome of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(nome)) g.deleteAttribute(nome)
    }
    if (!g.attributes.uv) {
      // Sem uv a fusão quebra; um uv nulo é inofensivo porque o material
      // dessa malha não tem textura para amostrar.
      const n = g.attributes.position.count
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2))
    }
    if (!g.attributes.normal) g.computeVertexNormals()

    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(normalizar, o.matrixWorld))

    const mat = Array.isArray(o.material) ? o.material[0] : o.material
    const chave = mat.uuid
    if (!grupos.has(chave)) grupos.set(chave, { material: mat, geos: [] })
    grupos.get(chave).geos.push(g)
  })

  const partes = []
  for (const { material, geos } of grupos.values()) {
    const geo = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
    if (!geo) {
      // Fusão recusada (atributos incompatíveis): entra sem fundir, porque
      // perder a malha é pior que gastar desenhos a mais.
      geos.forEach((g) => partes.push({ geometry: g, material }))
      continue
    }
    if (geos.length > 1) geos.forEach((g) => g.dispose())
    partes.push({ geometry: geo, material })
  }

  const comprimento = (girar ? tam.x : tam.z) * escala
  const largura = (girar ? tam.z : tam.x) * escala
  return { partes, comprimento, largura, altura }
}

/** Um InstancedMesh por parte, todos compartilhando as mesmas N matrizes. */
function instanciar(modelo, quantidade, scene, fog) {
  return modelo.partes.map(({ geometry, material }) => {
    const mat = material.clone()
    mat.fog = fog
    // NÃO mexer na transparência destes materiais. A primeira versão desligava
    // o blend de quem tinha opacidade alta, para poupar ordenação — e opacou o
    // plano de sombra assada do carro, que é um quad preto com a sombra
    // desenhada no ALPHA da textura e opacidade 1 no material. O resultado foi
    // um retângulo preto de seis metros seguindo o carro pela estrada.
    const inst = new THREE.InstancedMesh(geometry, mat, quantidade)
    inst.frustumCulled = false
    inst.castShadow = false
    inst.receiveShadow = false
    scene.add(inst)
    return inst
  })
}

/* ============================================================== atlas ==== */

/** Os anos, desenhados em canvas. Só texto — as fotos agora são planos. */
async function buildYearAtlas(years) {
  const rows = Math.max(1, Math.ceil(years.length / COLS))
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

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return { texture, rows }
}

/** Mancha escura no chão, para as figuras não parecerem flutuando. */
function texturaSombra() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,0.75)')
  grad.addColorStop(0.5, 'rgba(0,0,0,0.32)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

function makeEasing(gates) {
  return (p) => {
    let slow = 0
    for (const g of gates) {
      const d = Math.abs(p - g)
      // Poço de desaceleração em torno do marco.
      //
      // Alargado e rebaixado em relação à primeira calibragem (0,0016 e 0,6).
      // Um poço estreito e fundo freia e solta a câmera em poucos pixels de
      // rolagem, e o que se sente não é um documentário desacelerando: é um
      // tranco. Mais largo, a mesma quantidade de atenção no marco chega
      // distribuída ao longo do trecho inteiro.
      slow += Math.exp(-(d * d) / 0.0052) * 0.42
    }
    return slow
  }
}

/* ============================================================== cena ===== */

export async function createRoadTimeline(canvas, entries, modelos = {}) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
  } catch {
    return null
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6))
  renderer.outputColorSpace = THREE.SRGBColorSpace

  const years = entries.map((e) => e.year)
  const { texture: yearAtlas, rows } = await buildYearAtlas(years)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 420)
  camera.position.set(0, 1.55, 4)

  const light = new THREE.Color()
  const fog = new THREE.Color()

  const roadUniforms = {
    uLight: { value: new THREE.Color(0.75, 0.72, 0.8) },
    uFog: { value: new THREE.Color(0.02, 0.008, 0.012) },
    uLen: { value: ROAD_LEN },
    uNear: { value: FOG_NEAR },
    uFar: { value: FOG_FAR },
  }

  // Os modelos usam material padrão do glTF, que responde a luz e a fog do
  // three — ao contrário de todo o resto da cena, que é shader próprio. Então
  // a cena ganha uma névoa e duas luzes de verdade, e a cor das três é
  // reescrita a cada quadro com a mesma cor de era que tinge os shaders. É o
  // que mantém asfalto, céu e cidade sob a mesma iluminação.
  scene.fog = new THREE.Fog(roadUniforms.uFog.value.clone(), FOG_NEAR, FOG_FAR)

  const ceu = new THREE.HemisphereLight(0xffffff, 0x140a10, 1.15)
  scene.add(ceu)
  const sol = new THREE.DirectionalLight(0xffffff, 2.1)
  // Vindo de frente e de cima: é o pôr do sol que o shader do céu desenha no
  // fundo, e a luz da cena tem que concordar com ele.
  sol.position.set(-0.35, 0.62, -1)
  scene.add(sol)

  // --- o céu ----------------------------------------------------------------
  const skyUniformsRef = {
    uLight: roadUniforms.uLight,
    uFog: roadUniforms.uFog,
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
  }

  const skyQuad = new THREE.PlaneGeometry(2, 2)
  const sky = new THREE.Mesh(
    skyQuad,
    new THREE.ShaderMaterial({
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      uniforms: skyUniformsRef,
      depthTest: false,
      depthWrite: false,
      fog: false,
    })
  )
  sky.frustumCulled = false
  sky.renderOrder = -1
  scene.add(sky)

  // --- a estrada ------------------------------------------------------------
  const road = new THREE.Mesh(
    new THREE.PlaneGeometry(ROAD_W, ROAD_LEN, 1, 1),
    new THREE.ShaderMaterial({
      vertexShader: ROAD_VERT,
      fragmentShader: ROAD_FRAG,
      uniforms: roadUniforms,
      fog: false,
    })
  )
  road.rotation.x = -Math.PI / 2
  road.position.z = -ROAD_LEN / 2
  scene.add(road)

  // Calçada dos dois lados: o asfalto terminava no vazio e os prédios ficavam
  // plantados no nada. Uma faixa escura entre a pista e a fachada é o que faz
  // a rua ter margem.
  const calcadaMat = new THREE.MeshStandardMaterial({
    color: 0x120b0e,
    roughness: 0.95,
    metalness: 0,
  })
  const calcadas = [-1, 1].map((lado) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(11, ROAD_LEN), calcadaMat)
    m.rotation.x = -Math.PI / 2
    m.position.set(lado * (ROAD_W / 2 + 5.5), 0.015, -ROAD_LEN / 2)
    scene.add(m)
    return m
  })

  // Meio-fio: a faixa elevada entre o asfalto e a calçada. Sem ele os dois
  // planos se encostam no mesmo nível e a rua não tem margem — parece asfalto
  // pintado de dois tons, não uma via com guia.
  const guiaMat = new THREE.MeshStandardMaterial({
    color: 0x6a6058,
    roughness: 0.9,
    metalness: 0,
  })
  const guiaGeo = new THREE.BoxGeometry(0.45, 0.22, ROAD_LEN)
  const guias = [-1, 1].map((lado) => {
    const m = new THREE.Mesh(guiaGeo, guiaMat)
    m.position.set(lado * (ROAD_W / 2 + 0.22), 0.11, -ROAD_LEN / 2)
    scene.add(m)
    return m
  })

  // --- postes ---------------------------------------------------------------
  //
  // Antes existia só o halo, sem nada segurando a luz. Funcionava à noite
  // fechada e passou a não funcionar: com o asfalto refletindo e o céu de fim
  // de tarde, luzes flutuando sem mastro viram bolhas. O mastro é barato
  // (dois boxes por poste, instanciados) e é ele que dá o ritmo vertical da
  // rua — o metrônomo que faz a velocidade da câmera ser sentida.
  const POSTES = 24
  const mastroGeo = new THREE.BoxGeometry(0.16, 7.4, 0.16)
  const bracoGeo = new THREE.BoxGeometry(1.5, 0.13, 0.13)
  const posteMat = new THREE.MeshStandardMaterial({
    color: 0x14100f,
    roughness: 0.75,
    metalness: 0.4,
  })
  const mastros = new THREE.InstancedMesh(mastroGeo, posteMat, POSTES)
  const bracos = new THREE.InstancedMesh(bracoGeo, posteMat, POSTES)
  mastros.frustumCulled = false
  bracos.frustumCulled = false
  scene.add(mastros)
  scene.add(bracos)

  const posteDummy = new THREE.Object3D()
  for (let i = 0; i < POSTES; i++) {
    const lado = i % 2 ? 1 : -1
    const z = -12 - Math.floor(i / 2) * 33
    posteDummy.position.set(lado * (ROAD_W / 2 + 0.9), 3.7, z)
    posteDummy.rotation.set(0, 0, 0)
    posteDummy.updateMatrix()
    mastros.setMatrixAt(i, posteDummy.matrix)
    // O braço avança sobre a pista, e é na ponta dele que o halo já existia.
    posteDummy.position.set(lado * (ROAD_W / 2 + 0.2), 7.3, z)
    posteDummy.updateMatrix()
    bracos.setMatrixAt(i, posteDummy.matrix)
  }
  mastros.instanceMatrix.needsUpdate = true
  bracos.instanceMatrix.needsUpdate = true

  // --- halos --------------------------------------------------------------
  // O halo agora tem dono: fica exatamente na ponta do braço de cada poste, e
  // não mais espalhado por conta própria. Continua sendo billboard aditivo
  // porque geometria não brilha — a luminária é o mastro, a luz é o quad.
  const POLES = POSTES
  const glowGeo = new THREE.InstancedBufferGeometry()
  const glowQuad = new THREE.PlaneGeometry(1, 1)
  glowGeo.index = glowQuad.index
  glowGeo.attributes.position = glowQuad.attributes.position
  glowGeo.attributes.uv = glowQuad.attributes.uv
  glowGeo.instanceCount = POLES

  const gPos = new Float32Array(POLES * 3)
  const gSize = new Float32Array(POLES)
  for (let i = 0; i < POLES; i++) {
    const lado = i % 2 ? 1 : -1
    // Mesmos números do laço dos postes: a luz nasce onde a luminária está.
    gPos[i * 3] = lado * (ROAD_W / 2 + 0.55)
    gPos[i * 3 + 1] = 7.2
    gPos[i * 3 + 2] = -12 - Math.floor(i / 2) * 33
    gSize[i] = 3.4 + Math.random() * 1.4
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
      fog: false,
    })
  )
  glows.frustumCulled = false
  glows.renderOrder = 2
  scene.add(glows)

  // --- faróis distantes -----------------------------------------------------
  // Tráfego que nunca chega perto: pares de luz correndo ao fundo. Custa dois
  // quads por carro em vez de 414 mil triângulos, e a distância em que eles
  // vivem é justamente aquela em que um carro modelado seria um borrão.
  const TRAFEGO = 16
  const carLightGeo = new THREE.InstancedBufferGeometry()
  const carQuad = new THREE.PlaneGeometry(1, 1)
  carLightGeo.index = carQuad.index
  carLightGeo.attributes.position = carQuad.attributes.position
  carLightGeo.attributes.uv = carQuad.attributes.uv
  carLightGeo.instanceCount = TRAFEGO * 2

  const lPos = new Float32Array(TRAFEGO * 2 * 3)
  const lSize = new Float32Array(TRAFEGO * 2)
  const lSeed = new Float32Array(TRAFEGO * 2)
  const faixas = []
  for (let i = 0; i < TRAFEGO; i++) {
    const vindo = i % 2 === 0
    faixas.push({
      x: (vindo ? -1 : 1) * ROAD_W * 0.24,
      z: -(i / TRAFEGO) * ROAD_LEN,
      speed: (11 + Math.random() * 16) * (vindo ? 1 : -1),
      vindo,
    })
    for (let k = 0; k < 2; k++) {
      lSize[i * 2 + k] = vindo ? 1.5 : 1.0
      lSeed[i * 2 + k] = vindo ? 0.9 : 0.1
    }
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
      fog: false,
    })
  )
  carLights.frustumCulled = false
  carLights.renderOrder = 3
  scene.add(carLights)

  const posAttr = carLightGeo.getAttribute('aPos')
  const moverTrafego = (t) => {
    for (let i = 0; i < TRAFEGO; i++) {
      const f = faixas[i]
      let z = f.z + t * f.speed
      z = ((z % ROAD_LEN) + ROAD_LEN) % ROAD_LEN - ROAD_LEN
      for (let k = 0; k < 2; k++) {
        const j = i * 2 + k
        posAttr.array[j * 3] = f.x + (k ? 0.6 : -0.6)
        posAttr.array[j * 3 + 1] = 0.72
        posAttr.array[j * 3 + 2] = z
      }
    }
    posAttr.needsUpdate = true
  }

  // --- poeira no ar ---------------------------------------------------------
  //
  // O que separa uma rua renderizada de uma rua fotografada quase nunca é
  // geometria: é o ar entre a câmera e o assunto. Oitocentos grãos suspensos,
  // acesos pela luz da era, dão volume ao vazio que o asfalto e as fachadas
  // deixam no meio do quadro.
  const POEIRA = 800
  const dustGeo = new THREE.BufferGeometry()
  const dPos = new Float32Array(POEIRA * 3)
  const dSeed = new Float32Array(POEIRA)
  for (let i = 0; i < POEIRA; i++) {
    dPos[i * 3] = (Math.random() - 0.5) * 26
    dPos[i * 3 + 1] = 0.2 + Math.random() * 7
    dPos[i * 3 + 2] = Math.random() * 60
    dSeed[i] = Math.random()
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3))
  dustGeo.setAttribute('aPos', new THREE.BufferAttribute(dPos, 3))
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dSeed, 1))

  const dustUniforms = {
    uTime: { value: 0 },
    uCamZ: { value: 0 },
    uLight: roadUniforms.uLight,
  }
  const poeira = new THREE.Points(
    dustGeo,
    new THREE.ShaderMaterial({
      vertexShader: DUST_VERT,
      fragmentShader: DUST_FRAG,
      uniforms: dustUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    })
  )
  poeira.frustumCulled = false
  poeira.renderOrder = 4
  scene.add(poeira)

  // --- os anos no asfalto ---------------------------------------------------
  // Espaçamento dos marcos ao longo da estrada.
  //
  // O primeiro marco recuou de 30 para 68. A conta antiga dava ao primeiro ano
  // só trinta unidades de aproximação (a câmera larga em z=4) contra setenta
  // das outras eras — e como a legenda agora vive na janela em que a figura
  // está à frente, a de 2022 aparecia por um piscar e sumia. Com o recuo, as
  // cinco eras têm aproximação equivalente.
  const PASSO_MARCO = (ROAD_LEN - 110) / entries.length
  const marcoZ = (i) => -68 - i * PASSO_MARCO

  const yearGeo = new THREE.InstancedBufferGeometry()
  const yearQuad = new THREE.PlaneGeometry(1, 1)
  yearGeo.index = yearQuad.index
  yearGeo.attributes.position = yearQuad.attributes.position
  yearGeo.attributes.uv = yearQuad.attributes.uv
  yearGeo.instanceCount = entries.length

  const yPos = new Float32Array(entries.length * 3)
  const yCell = new Float32Array(entries.length * 2)
  const ySize = new Float32Array(entries.length * 2)
  entries.forEach((_, i) => {
    yPos[i * 3] = 0
    yPos[i * 3 + 1] = 0.02
    yPos[i * 3 + 2] = marcoZ(i)
    yCell[i * 2] = (i % COLS) / COLS
    yCell[i * 2 + 1] = 1 - (Math.floor(i / COLS) + 1) / rows
    // Maior que antes (era 3,6). O ano deixou de ser um detalhe pintado no
    // asfalto e virou o eixo da composição: ele fica no chão exatamente entre
    // as duas figuras da era, e é ele que amarra o par.
    ySize[i * 2] = 6.2
    ySize[i * 2 + 1] = 6.2
  })
  yearGeo.setAttribute('aPos', new THREE.InstancedBufferAttribute(yPos, 3))
  yearGeo.setAttribute('aCell', new THREE.InstancedBufferAttribute(yCell, 2))
  yearGeo.setAttribute('aSize', new THREE.InstancedBufferAttribute(ySize, 2))

  const anos = new THREE.Mesh(
    yearGeo,
    new THREE.ShaderMaterial({
      vertexShader: YEAR_VERT,
      fragmentShader: YEAR_FRAG,
      uniforms: {
        uAtlas: { value: yearAtlas },
        uCellSize: { value: new THREE.Vector2(1 / COLS, 1 / rows) },
        uFog: roadUniforms.uFog,
        uLight: roadUniforms.uLight,
      },
      transparent: true,
      depthWrite: false,
      fog: false,
    })
  )
  anos.frustumCulled = false
  scene.add(anos)

  // --- as figuras do artista ------------------------------------------------
  //
  // Recortes de corpo inteiro, dois por era, em pé no acostamento. Ficam do
  // MESMO lado e separados ao longo da rua, então a câmera passa pelos dois em
  // sequência em vez de ver os dois de uma vez e nenhum direito.
  //
  // Eles não giram para seguir a câmera. Billboard resolveria a leitura em
  // qualquer ângulo, mas entrega na hora que é um plano: um recorte que gira
  // quando você passa por ele nunca esteve ali. Como a câmera só anda em linha
  // reta pela estrada, uma rotação fixa levemente virada para a pista basta —
  // e assim eles ficam de fato plantados no chão.
  const sombraTex = texturaSombra()
  const sombraMat = new THREE.MeshBasicMaterial({
    map: sombraTex,
    transparent: true,
    depthWrite: false,
    fog: true,
  })
  const figuras = []
  const figLoader = new THREE.TextureLoader()

  entries.forEach((e, i) => {
    if (!e.figuras || !e.figuras.length) return
    e.figuras.forEach((url, k) => {
      // Uma de cada lado da rua. Com as duas no mesmo acostamento, metade do
      // quadro ficava vazia e o par lia como um bloco só; separadas, a câmera
      // passa ENTRE elas e o corredor da rua vira o eixo da composição.
      const lado = k === 0 ? -1 : 1
      const tex = figLoader.load(url)
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy()

      const alt = 4.1
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true,
        // alphaTest corta o halo cinza que sobra na borda do recorte quando o
        // alpha é interpolado. Sem ele a figura ganha um contorno claro contra
        // o fundo escuro.
        alphaTest: 0.35,
        side: THREE.DoubleSide,
        fog: true,
      })
      const plano = new THREE.Mesh(new THREE.PlaneGeometry(alt * 0.66, alt), mat)

      // LADO A LADO, e não em fila.
      //
      // Na primeira montagem os dois recortes ficavam no mesmo x e separados
      // ao longo da rua. Como a câmera anda por cima desse eixo, o que estava
      // mais perto crescia até entrar cortado pela borda enquanto o outro
      // ainda era um ponto ao fundo — nunca dava para ver o par. Separados no
      // eixo TRANSVERSAL eles ficam na mesma profundidade, entram no quadro
      // juntos e saem juntos. O de trás recua um pouco na diagonal para os
      // dois não se encavalarem.
      // Mesma profundidade nas duas: entram e saem juntas do quadro.
      const z = marcoZ(i) + 4
      // Recuadas para o fundo da calçada. A 2,4 do eixo elas dividiam o mesmo
      // metro de acostamento com os carros estacionados, e o resultado era uma
      // figura de pé EM CIMA do capô — o carro ocupa o meio-fio, quem está a
      // pé fica atrás dele.
      const x = lado * (ROAD_W / 2 + 4.6)
      plano.position.set(x, alt / 2, z)
      plano.rotation.y = lado * 0.22 // virado de leve para a pista
      scene.add(plano)

      const sombra = new THREE.Mesh(new THREE.PlaneGeometry(alt * 0.9, alt * 0.5), sombraMat)
      sombra.rotation.x = -Math.PI / 2
      sombra.position.set(x, 0.03, z)
      scene.add(sombra)

      figuras.push({ plano, sombra, tex, mat, era: i, lado, alt, baseY: alt / 2 })
    })
  })

  // --- o ponteiro sobre as figuras -------------------------------------------
  //
  // Passar o mouse numa figura a traz para a frente. Como elas são objetos da
  // cena e não elementos do DOM, não existe :hover — o que existe é lançar um
  // raio da câmera pelo ponto do cursor e ver o que ele encontra.
  //
  // O crescimento é ancorado na BASE, não no centro. Um plano escalado pelo
  // centro afunda metade do aumento dentro do chão, e a figura passa a flutuar
  // ao encolher de volta; subir o centro em proporção mantém os pés no lugar.
  const raycaster = new THREE.Raycaster()
  const ponteiro = new THREE.Vector2()
  let sobre = null

  const destacar = (f, ativo) => {
    if (!f) return
    const alvo = ativo ? 1.34 : 1
    gsap.killTweensOf(f.plano.scale)
    gsap.to(f.plano.scale, {
      x: alvo,
      y: alvo,
      duration: 0.42,
      ease: 'power3.out',
      onUpdate: () => {
        f.plano.position.y = f.baseY * f.plano.scale.y
      },
    })
    gsap.to(f.sombra.scale, { x: alvo, y: alvo, duration: 0.42, ease: 'power3.out' })
  }

  const onPointerMove = (e) => {
    if (!figuras.length) return
    const r = canvas.getBoundingClientRect()
    ponteiro.x = ((e.clientX - r.left) / r.width) * 2 - 1
    ponteiro.y = -((e.clientY - r.top) / r.height) * 2 + 1
    raycaster.setFromCamera(ponteiro, camera)
    const hits = raycaster.intersectObjects(figuras.map((f) => f.plano), false)
    const achou = hits.length ? figuras.find((f) => f.plano === hits[0].object) : null
    if (achou === sobre) return
    destacar(sobre, false)
    sobre = achou
    destacar(sobre, true)
    canvas.style.cursor = sobre ? 'pointer' : ''
    if (!running) render()
  }

  const onPointerLeave = () => {
    if (!sobre) return
    destacar(sobre, false)
    sobre = null
    canvas.style.cursor = ''
    if (!running) render()
  }

  // Só com ponteiro fino: num toque, "passar o mouse" não existe, e escalar a
  // figura no primeiro contato seria um efeito sem gesto que o justifique.
  const temMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches
  if (temMouse) {
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)
  }

  // --- prédios e carros -----------------------------------------------------
  //
  // Carregados depois que a cena já está de pé. São 25 MB de modelo: esperar
  // por eles antes de mostrar qualquer coisa deixaria a seção preta durante
  // todo o download, e a estrada com céu e asfalto já é uma cena assistível.
  const PREDIOS = 24
  const CARROS = 3
  let predioInst = []
  let carroInst = []
  let carroModelo = null
  const dummy = new THREE.Object3D()
  const carros = []
  let descartado = false

  const montarCenario = async () => {
    // O catch avisa em vez de engolir.
    //
    // A primeira versão fazia .catch(() => null) mudo, e quando o carro.glb
    // sumiu da pasta (renomeado) a cena simplesmente montou sem carro: nenhum
    // erro no console, nenhuma pista. Um asset que falta é um problema de
    // conteúdo, não uma condição excepcional — a cena continua de pé sem ele,
    // mas alguém precisa ficar sabendo.
    const carregar = (url, opcoes, nome) =>
      url
        ? carregarModelo(url, opcoes).catch((e) => {
            console.warn(`[trajetoria] modelo "${nome}" não carregou (${url}):`, e?.message || e)
            return null
          })
        : Promise.resolve(null)

    const [predio, carro] = await Promise.all([
      carregar(modelos.predio, { altura: 21 }, 'predio'),
      carregar(modelos.carro, { altura: 1.45, alinharZ: true }, 'carro'),
    ])
    if (descartado) return

    if (predio) {
      predioInst = instanciar(predio, PREDIOS, scene, true)
      const passo = (ROAD_LEN - 40) / (PREDIOS / 2)
      for (let i = 0; i < PREDIOS; i++) {
        const lado = i % 2 ? 1 : -1
        const n = Math.floor(i / 2)
        // Escala e recuo variados: fachada idêntica repetida vira papel de
        // parede, e o olho pega a repetição antes de pegar a cidade.
        const s = 0.78 + ((n * 37) % 11) / 22
        const recuo = ROAD_W / 2 + 17 + ((n * 53) % 7) * 0.9
        dummy.position.set(lado * recuo, 0, -26 - n * passo + (lado > 0 ? passo * 0.45 : 0))
        dummy.rotation.set(0, lado > 0 ? -Math.PI / 2 : Math.PI / 2, 0)
        dummy.scale.setScalar(s)
        dummy.updateMatrix()
        predioInst.forEach((inst) => inst.setMatrixAt(i, dummy.matrix))
      }
      predioInst.forEach((inst) => (inst.instanceMatrix.needsUpdate = true))
    }

    if (carro) {
      carroModelo = carro
      carroInst = instanciar(carro, CARROS, scene, true)
      // Um carro acompanha a câmera na faixa da direita — é a tomada de
      // carro-câmera, e a única forma de um modelo com 414 mil triângulos
      // aparecer grande na tela o tempo todo sem multiplicar o custo. Os
      // outros dois ficam estacionados e são reposicionados à frente conforme
      // a câmera avança, então três carros dão a impressão de uma rua cheia.
      carros.push({ tipo: 'segue', x: ROAD_W * 0.26, dz: -7.5, giro: Math.PI })
      // Os estacionados andam no MESMO passo dos marcos (70) e deslocados meio
      // passo. É o que garante que eles nunca caiam em cima de um ano — antes
      // o passo era 96 contra 70 dos marcos, os dois ciclos batiam de vez em
      // quando, e o carro aparecia estacionado exatamente onde estão as
      // figuras daquela era.
      const ENTRE = PASSO_MARCO
      carros.push({ tipo: 'parado', x: -(ROAD_W / 2 + 1.5), passo: ENTRE, fase: ENTRE * 0.5, giro: 0 })
      carros.push({ tipo: 'parado', x: ROAD_W / 2 + 1.5, passo: ENTRE, fase: ENTRE * 0.5, giro: Math.PI })
    }
  }

  const posicionarCarros = (t) => {
    if (!carroInst.length) return
    const camZ = camera.position.z
    carros.forEach((c, i) => {
      if (c.tipo === 'segue') {
        // Deriva lenta no eixo da rua: um carro que mantém distância exata é
        // um objeto colado na câmera, não um carro.
        dummy.position.set(c.x + Math.sin(t * 0.31) * 0.3, 0, camZ + c.dz + Math.sin(t * 0.44) * 1.6)
        dummy.rotation.set(0, c.giro, 0)
      } else {
        // Reciclagem: o carro fica sempre no múltiplo do passo mais próximo à
        // frente da câmera, então nunca é visto aparecendo do nada.
        // Ancorado na grade dos marcos e deslocado meio passo, então o carro
        // aparece sempre no meio do quarteirão. O índice entra na conta para
        // o da esquerda e o da direita não estacionarem emparelhados.
        const alvo = camZ - 40 - i * c.passo * 0.5
        const z = Math.round((alvo - c.fase) / c.passo) * c.passo + c.fase
        dummy.position.set(c.x, 0, z)
        dummy.rotation.set(0, c.giro, 0)
      }
      dummy.scale.setScalar(1)
      dummy.updateMatrix()
      carroInst.forEach((inst) => inst.setMatrixAt(i, dummy.matrix))
    })
    carroInst.forEach((inst) => (inst.instanceMatrix.needsUpdate = true))
  }

  montarCenario()

  // --- luz por era ----------------------------------------------------------
  // Fria no começo, dourada no meio, vinho e quase branca no fim: a luz conta
  // a história junto com os textos.
  const LUZES = [
    new THREE.Color('#7d8fa8'),
    new THREE.Color('#c9964a'),
    new THREE.Color('#9a2135'),
    new THREE.Color('#c41e3a'),
    new THREE.Color('#e8ded0'),
  ]
  const NEVOAS = [
    new THREE.Color('#05070c'),
    new THREE.Color('#0c0703'),
    new THREE.Color('#0d0306'),
    new THREE.Color('#0a0204'),
    new THREE.Color('#0e0a0a'),
  ]

  // Reaproveitado a cada quadro de scroll: alocar um Vector3 por atualização
  // é lixo garantido no meio de uma animação.
  const proj = new THREE.Vector3()

  const gates = entries.map((_, i) => (i + 0.5) / entries.length)
  const slowdown = makeEasing(gates)

  const resize = () => {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    skyUniformsRef.uRes.value.set(w, h)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
  }

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
    skyUniformsRef.uTime.value = clock
    dustUniforms.uTime.value = clock
    dustUniforms.uCamZ.value = camera.position.z
    moverTrafego(clock)
    posicionarCarros(clock)
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

  const onResize = () => {
    resize()
    render()
  }
  window.addEventListener('resize', onResize)
  resize()

  /**
   * Em que ponto do scroll a câmera está a uma dada distância de um marco.
   *
   * A posição da câmera não é linear no progresso — a curva de desaceleração
   * está no meio — então "quando eu chego no ano 2023" não é uma conta, é uma
   * busca na tabela que já foi integrada acima.
   *
   * Isto existe porque o card de texto e a figura precisavam estar no quadro
   * ao MESMO tempo, e não estavam: o card entrava numa fatia fixa do scroll
   * (um quinto por era) enquanto a figura vivia num ponto fixo da estrada. Na
   * prática, quando o texto aparecia a câmera já tinha passado pela foto, e a
   * projeção caía atrás do observador.
   */
  const tNaDistancia = (era, distancia) => {
    const zAlvo = marcoZ(era) + 4 + distancia
    const percorrido = (4 - zAlvo) / (ROAD_LEN - 40)
    if (percorrido <= 0) return 0
    if (percorrido >= 1) return 1
    // A tabela é monótona, então a primeira entrada que alcança o valor é a
    // resposta; STEPS = 600 dá resolução de sobra para uma animação de scroll.
    for (let i = 0; i <= STEPS; i++) {
      if (table[i] >= percorrido) return i / STEPS
    }
    return 1
  }

  // A janela de cada era: começa com a figura ainda longe, à frente, e fecha
  // pouco antes da câmera emparelhar com ela — passando desse ponto a foto sai
  // pela borda e o texto ficaria apontando para fora da tela.
  const janelas = entries.map((_, i) => ({
    inicio: tNaDistancia(i, 62),
    fim: tNaDistancia(i, 7),
  }))

  return {
    janelas,
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
      const f = t * (LUZES.length - 1)
      const i0 = Math.min(LUZES.length - 1, Math.floor(f))
      const i1 = Math.min(LUZES.length - 1, i0 + 1)
      const k = f - i0
      light.copy(LUZES[i0]).lerp(LUZES[i1], k)
      fog.copy(NEVOAS[i0]).lerp(NEVOAS[i1], k)
      roadUniforms.uLight.value.copy(light)
      roadUniforms.uFog.value.copy(fog)

      // Os modelos não leem os uniforms dos shaders próprios; para eles a era
      // chega pela luz direcional e pela névoa da cena.
      scene.fog.color.copy(fog)
      sol.color.copy(light).lerp(new THREE.Color(1, 1, 1), 0.45)
      ceu.color.copy(light).lerp(new THREE.Color(1, 1, 1), 0.25)
      renderer.setClearColor(fog, 1)

      dustUniforms.uCamZ.value = camera.position.z
      posicionarCarros(clock)
      render()
      // Onde a legenda de cada era deve ser desenhada.
      //
      // O card é HTML por cima do canvas — tipografia nítida em qualquer tela
      // vale mais do que texto em textura. Mas ele estava ancorado num canto
      // fixo, longe do assunto. Projetando a figura para coordenadas de tela,
      // o texto passa a acompanhar quem ele descreve.
      //
      // TODAS as eras são projetadas, não só a "corrente". Escolher uma aqui
      // dentro exigiria repetir a regra que decide qual card está visível — e
      // quando as duas regras discordaram (uma contava fatias iguais de
      // scroll, a outra a geometria da estrada) o resultado foi posicionar um
      // card invisível enquanto o visível ficava parado no canto. Quatro
      // projeções por quadro não custam nada; duas fontes de verdade custam.
      //
      // A figura projetada é a da ESQUERDA e o texto vai à direita dela: é o
      // lado que sobra livre, já que a outra do par ocupa a direita da pista.
      const w = canvas.clientWidth || 1
      const h = canvas.clientHeight || 1
      const marcas = figuras
        .filter((f) => f.lado < 0)
        .map((f) => {
          proj.setFromMatrixPosition(f.plano.matrixWorld)
          proj.project(camera)
          return {
            era: f.era,
            x: (proj.x * 0.5 + 0.5) * w,
            y: (-proj.y * 0.5 + 0.5) * h,
            // Três condições, e as três importam. z fora de [-1,1] é atrás da
            // câmera ou além do far. E mesmo à frente, um ponto projetado
            // longe demais na horizontal levaria o card para fora da tela — o
            // teto de 0,6 em x garante que sobre largura para o bloco ao lado.
            dentro:
              proj.z > -1 &&
              proj.z < 1 &&
              proj.x > -1.05 &&
              proj.x < 0.6 &&
              proj.y > -0.9 &&
              proj.y < 0.95,
          }
        })

      return { light: `#${light.getHexString()}`, index: i0, marcas }
    },
    dispose() {
      descartado = true
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)

      const limpar = (lista) =>
        lista.forEach((inst) => {
          scene.remove(inst)
          inst.geometry.dispose()
          inst.material.dispose()
          inst.dispose()
        })
      limpar(predioInst)
      limpar(carroInst)
      // As geometrias fundidas são compartilhadas pelas instâncias, então já
      // saíram acima; sobram os materiais originais do glTF.
      carroModelo?.partes.forEach((p) => p.material.dispose())

      figuras.forEach(({ plano, sombra, tex, mat }) => {
        scene.remove(plano)
        scene.remove(sombra)
        plano.geometry.dispose()
        sombra.geometry.dispose()
        mat.dispose()
        tex.dispose()
      })
      sombraMat.dispose()
      sombraTex.dispose()
      calcadas.forEach((m) => {
        scene.remove(m)
        m.geometry.dispose()
      })
      calcadaMat.dispose()

      scene.remove(poeira)
      dustGeo.dispose()
      poeira.material.dispose()
      scene.remove(mastros)
      scene.remove(bracos)
      mastroGeo.dispose()
      bracoGeo.dispose()
      posteMat.dispose()
      mastros.dispose()
      bracos.dispose()
      guias.forEach((g) => scene.remove(g))
      guiaGeo.dispose()
      guiaMat.dispose()
      carQuad.dispose()
      carLightGeo.dispose()
      carLights.material.dispose()
      yearQuad.dispose()
      yearGeo.dispose()
      anos.material.dispose()
      glowQuad.dispose()
      glowGeo.dispose()
      glows.material.dispose()
      skyQuad.dispose()
      sky.material.dispose()
      road.geometry.dispose()
      road.material.dispose()
      yearAtlas.dispose()
      renderer.dispose()
    },
    // Exposto para medição: quantos triângulos a cena realmente desenha.
    info: () => renderer.info.render,
  }
}
