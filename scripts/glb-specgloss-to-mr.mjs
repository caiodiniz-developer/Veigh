/**
 * Converte materiais KHR_materials_pbrSpecularGlossiness para o
 * pbrMetallicRoughness do core do glTF.
 *
 * Por que isto existe: o carro.glb veio do Sketchfab com spec-gloss, uma
 * extensão que o three.js REMOVEU do GLTFLoader (na 0.185 ela nem aparece
 * mais no código — o loader só imprime "Unknown extension" e segue). Como
 * esses materiais não têm pbrMetallicRoughness nenhum, o resultado é um carro
 * branco liso, sem uma única textura. Não é um bug sutil: some o modelo
 * inteiro visualmente.
 *
 * A conversão é a canônica: a cor difusa vira cor base, e o brilho vira o
 * inverso da rugosidade. O que se perde é a resposta especular colorida dos
 * metais, que spec-gloss descreve melhor — por isso os materiais com nome de
 * metal recebem metallic alto na mão, que é onde a diferença apareceria.
 *
 * Roda in-place: node scripts/glb-specgloss-to-mr.mjs <arquivo.glb>
 * O original continua no histórico do git.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SG = 'KHR_materials_pbrSpecularGlossiness'

// Cor do carro. O briefing pediu carro vinho na estrada, e o modelo veio com
// pintura cinza. O fator multiplica a textura de pintura, então o desenho da
// lataria (reflexos, sujeira, quinas) sobrevive — muda só o pigmento.
// glTF trabalha em espaço linear, não sRGB.
const WINE_LINEAR = [0.3, 0.022, 0.045, 1]

const isMetal = (name = '') => /chrome|metal|miror|mirror|grill/i.test(name)

// O nome não basta. Neste modelo o material chamado "car_paint" é um cinza de
// detalhe, e quem pinta a lataria é um "lambert17" com difusa [0.84, 0.005,
// 0.005] — vermelho puro. Então a regra olha a COR: vermelho forte e sem
// verde nem azul é lataria. Um pisca-alerta laranja tem verde demais para
// passar por aqui, que é exatamente o que se quer.
const isPaint = (name = '', d) => {
  if (/car_paint|carpaint/i.test(name)) return true
  if (!Array.isArray(d)) return false
  const [r, g, b] = d
  return r > 0.5 && r > g * 4 && r > b * 4
}

function convert(json) {
  let touched = 0
  for (const m of json.materials || []) {
    const sg = m.extensions?.[SG]
    if (!sg) continue
    touched++

    const gloss = sg.glossinessFactor ?? 1
    const metal = isMetal(m.name)

    m.pbrMetallicRoughness = {
      baseColorFactor: isPaint(m.name, sg.diffuseFactor) ? WINE_LINEAR : (sg.diffuseFactor ?? [1, 1, 1, 1]),
      metallicFactor: metal ? 1 : 0,
      // Metal cromado com a rugosidade derivada do gloss fica fosco demais;
      // cromo é liso por definição.
      roughnessFactor: metal ? 0.12 : Math.min(Math.max(1 - gloss, 0.04), 1),
    }
    if (sg.diffuseTexture) m.pbrMetallicRoughness.baseColorTexture = sg.diffuseTexture

    delete m.extensions[SG]
    if (!Object.keys(m.extensions).length) delete m.extensions
  }

  json.extensionsUsed = (json.extensionsUsed || []).filter((e) => e !== SG)
  if (!json.extensionsUsed.length) delete json.extensionsUsed
  json.extensionsRequired = (json.extensionsRequired || []).filter((e) => e !== SG)
  if (!json.extensionsRequired.length) delete json.extensionsRequired

  return touched
}

const file = process.argv[2]
if (!file) throw new Error('uso: node scripts/glb-specgloss-to-mr.mjs <arquivo.glb>')

const buf = readFileSync(file)
if (buf.toString('ascii', 0, 4) !== 'glTF') throw new Error('não é um GLB')

const jsonLen = buf.readUInt32LE(12)
const json = JSON.parse(buf.toString('utf8', 20, 20 + jsonLen))

// O chunk binário começa logo depois do JSON, já alinhado em 4 bytes.
const binStart = 20 + jsonLen
const binLen = buf.readUInt32LE(binStart)
const bin = buf.subarray(binStart + 8, binStart + 8 + binLen)

const n = convert(json)

// Reempacota. O padding do JSON é espaço (0x20) e o do BIN é zero — está na
// spec, e um leitor estrito rejeita o arquivo se vier outra coisa.
let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8')
const jsonPad = (4 - (jsonBuf.length % 4)) % 4
if (jsonPad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jsonPad, 0x20)])

const binPad = (4 - (bin.length % 4)) % 4
const binBuf = binPad ? Buffer.concat([bin, Buffer.alloc(binPad, 0)]) : bin

const total = 12 + 8 + jsonBuf.length + 8 + binBuf.length
const head = Buffer.alloc(12)
head.write('glTF', 0, 'ascii')
head.writeUInt32LE(2, 4)
head.writeUInt32LE(total, 8)

const jsonHead = Buffer.alloc(8)
jsonHead.writeUInt32LE(jsonBuf.length, 0)
jsonHead.write('JSON', 4, 'ascii')

const binHead = Buffer.alloc(8)
binHead.writeUInt32LE(binBuf.length, 0)
binHead.write('BIN\0', 4, 'ascii')

writeFileSync(file, Buffer.concat([head, jsonHead, jsonBuf, binHead, binBuf]))
console.log(`${file}: ${n} materiais convertidos, ${(total / 1048576).toFixed(1)}MB`)
