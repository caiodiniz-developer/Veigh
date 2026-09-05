/**
 * Gera as versões .webp das figuras da trajetória.
 *
 * Os recortes vêm em PNG RGBA de ~1024x1536 e pesam 0,8 a 1,8 MB cada. Oito
 * deles somam 11 MB — e a seção já carrega 25 MB de modelo 3D. PNG é sem
 * perdas, o que é o formato certo para um arquivo-fonte e o errado para uma
 * textura de WebGL: a mesma imagem em WebP com alpha cai para menos de um
 * décimo sem diferença visível a 5 metros de distância dentro da cena.
 *
 * Os PNG continuam sendo a fonte. Trocou uma foto? Roda de novo:
 *   node scripts/otimizar-figuras.mjs
 */
import { readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import ffmpeg from 'ffmpeg-static'

const DIR = 'public/trajetoria'
// 1200px de altura: dentro da cena a figura ocupa no máximo ~40% da altura da
// tela, então mais que isso é textura que nunca chega ao olho.
const ALTURA = 1200

let antes = 0
let depois = 0

for (const f of readdirSync(DIR).filter((n) => n.endsWith('.png'))) {
  const src = join(DIR, f)
  const out = src.replace(/\.png$/, '.webp')
  execFileSync(ffmpeg, [
    '-y', '-loglevel', 'error',
    '-i', src,
    '-vf', `scale=-2:${ALTURA}:flags=lanczos`,
    // O alpha do recorte é a razão de existir do arquivo; sem isto o libwebp
    // achata o fundo em branco e a figura volta a ter fundo.
    '-c:v', 'libwebp', '-lossless', '0', '-q:v', '84', '-compression_level', '6',
    '-pix_fmt', 'yuva420p',
    out,
  ])
  antes += statSync(src).size
  depois += statSync(out).size
  console.log(`${f} -> ${(statSync(out).size / 1024).toFixed(0)}KB`)
}

console.log(`total: ${(antes / 1048576).toFixed(1)}MB -> ${(depois / 1048576).toFixed(1)}MB`)
