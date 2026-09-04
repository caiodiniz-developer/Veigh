/**
 * Trilha sintetizada — o site deixa de ser mudo sem depender de um arquivo.
 *
 * Nada aqui é gravado. Room tone, impactos, risers e cliques são osciladores,
 * ruído e filtros montados na Web Audio API. Isso resolve dois problemas de
 * uma vez: não há o que licenciar, e não há megabytes de áudio no bundle.
 *
 * Três regras que governam o desenho:
 *
 * 1. O contexto só nasce depois de um gesto. Navegador nenhum deixa áudio
 *    tocar antes disso, e criar o AudioContext cedo demais o deixa "suspended"
 *    num estado difícil de recuperar.
 * 2. Tudo passa por um ganho mestre com rampa. Corte seco em áudio estala —
 *    o clique é a descontinuidade da onda, não o volume.
 * 3. Volume baixo por princípio. Trilha de site que se faz notar vira
 *    incômodo; esta existe para ser sentida, não ouvida.
 */

const MASTER = 0.22 // teto do ganho mestre: discreto de propósito

/** Timbre do room tone por capítulo. A luz muda, o ar da sala muda junto. */
const ROOMS = {
  intro: { base: 48, filter: 220, noise: 0.05, detune: 6 },
  manifesto: { base: 42, filter: 160, noise: 0.03, detune: 4 },
  history: { base: 52, filter: 260, noise: 0.06, detune: 8 },
  road: { base: 38, filter: 340, noise: 0.09, detune: 14 }, // estrada: mais ar
  shatter: { base: 34, filter: 140, noise: 0.02, detune: 3 },
  player: { base: 58, filter: 420, noise: 0.04, detune: 10 },
  sky: { base: 66, filter: 620, noise: 0.03, detune: 12 }, // aberto e claro
  stage: { base: 40, filter: 300, noise: 0.08, detune: 9 },
  world: { base: 30, filter: 120, noise: 0.04, detune: 5 }, // espaço, grave
  finale: { base: 44, filter: 200, noise: 0.03, detune: 6 },
  // A pausa não é um timbre: é a ausência dele. O silêncio só existe como
  // silêncio se houver algo para ele interromper.
  pause: { base: 36, filter: 90, noise: 0.0, detune: 0, duck: 0.12 },
}

function makeNoiseBuffer(ctx, seconds = 2) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

class Soundtrack {
  constructor() {
    this.ctx = null
    this.muted = false
    this.chapter = null
    this.ready = false
    this.lastClick = 0
  }

  /** Cria o contexto. Só funciona dentro de um gesto do usuário. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume()
      return true
    }
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return false

    const ctx = new Ctx()
    this.ctx = ctx

    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)

    // ---- room tone: dois osciladores desafinados + ruído filtrado ----------
    // Duas ondas quase no mesmo tom batem entre si e produzem uma oscilação
    // lenta de amplitude. É o que dá "sala" — um oscilador só soa como teste
    // de equipamento.
    this.roomGain = ctx.createGain()
    this.roomGain.gain.value = 0.5
    this.roomGain.connect(this.master)

    this.roomFilter = ctx.createBiquadFilter()
    this.roomFilter.type = 'lowpass'
    this.roomFilter.frequency.value = 200
    this.roomFilter.Q.value = 0.7
    this.roomFilter.connect(this.roomGain)

    this.oscA = ctx.createOscillator()
    this.oscB = ctx.createOscillator()
    this.oscA.type = 'sine'
    this.oscB.type = 'triangle'
    this.oscA.frequency.value = 48
    this.oscB.frequency.value = 48
    this.oscB.detune.value = 6
    this.oscA.connect(this.roomFilter)
    this.oscB.connect(this.roomFilter)
    this.oscA.start()
    this.oscB.start()

    this.noiseBuf = makeNoiseBuffer(ctx)
    this.noise = ctx.createBufferSource()
    this.noise.buffer = this.noiseBuf
    this.noise.loop = true
    this.noiseGain = ctx.createGain()
    this.noiseGain.gain.value = 0.05
    this.noiseFilter = ctx.createBiquadFilter()
    this.noiseFilter.type = 'bandpass'
    this.noiseFilter.frequency.value = 500
    this.noiseFilter.Q.value = 0.6
    this.noise.connect(this.noiseFilter)
    this.noiseFilter.connect(this.noiseGain)
    this.noiseGain.connect(this.roomGain)
    this.noise.start()

    this.ready = true
    this.setMuted(this.muted)
    if (this.chapter) this.setChapter(this.chapter, true)
    return true
  }

  setMuted(muted) {
    this.muted = muted
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.master.gain.cancelScheduledValues(t)
    this.master.gain.setValueAtTime(this.master.gain.value, t)
    // Rampa e não corte: mudar ganho instantaneamente estala.
    this.master.gain.linearRampToValueAtTime(muted ? 0 : MASTER, t + 0.4)
  }

  /** Troca o timbre do ar da sala. A transição é longa de propósito. */
  setChapter(name, force = false) {
    if (!force && this.chapter === name) return
    this.chapter = name
    if (!this.ready) return

    const room = ROOMS[name] || ROOMS.intro
    const t = this.ctx.currentTime
    const glide = name === 'pause' ? 0.9 : 2.2

    this.oscA.frequency.setTargetAtTime(room.base, t, glide / 3)
    this.oscB.frequency.setTargetAtTime(room.base, t, glide / 3)
    this.oscB.detune.setTargetAtTime(room.detune, t, glide / 3)
    this.roomFilter.frequency.setTargetAtTime(room.filter, t, glide / 3)
    this.noiseGain.gain.setTargetAtTime(room.noise, t, glide / 3)
    this.roomGain.gain.setTargetAtTime(room.duck ?? 0.5, t, glide / 3)
  }

  /** Golpe grave. Usado no estilhaçar da capa e na virada de capítulo. */
  impact(strength = 1) {
    if (!this.ready || this.muted) return
    const ctx = this.ctx
    const t = ctx.currentTime

    // Sub que despenca: a queda de frequência é o que faz o corpo do impacto.
    const sub = ctx.createOscillator()
    const subGain = ctx.createGain()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(120 * strength, t)
    sub.frequency.exponentialRampToValueAtTime(28, t + 0.55)
    subGain.gain.setValueAtTime(0.0001, t)
    subGain.gain.exponentialRampToValueAtTime(0.9 * strength, t + 0.012)
    subGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.7)
    sub.connect(subGain)
    subGain.connect(this.master)
    sub.start(t)
    sub.stop(t + 0.75)

    // Estalo de ar por cima, senão o golpe soa mole.
    const crack = ctx.createBufferSource()
    crack.buffer = this.noiseBuf
    const crackFilter = ctx.createBiquadFilter()
    crackFilter.type = 'bandpass'
    crackFilter.frequency.setValueAtTime(1800, t)
    crackFilter.frequency.exponentialRampToValueAtTime(220, t + 0.35)
    const crackGain = ctx.createGain()
    crackGain.gain.setValueAtTime(0.35 * strength, t)
    crackGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4)
    crack.connect(crackFilter)
    crackFilter.connect(crackGain)
    crackGain.connect(this.master)
    crack.start(t)
    crack.stop(t + 0.45)
  }

  /** Riser: tensão subindo. Cortado por quem chamar o corte. */
  riser(seconds = 2.4) {
    if (!this.ready || this.muted) return null
    const ctx = this.ctx
    const t = ctx.currentTime

    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.Q.value = 6
    filter.frequency.setValueAtTime(220, t)
    filter.frequency.exponentialRampToValueAtTime(3600, t + seconds)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.22, t + seconds * 0.85)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start(t)
    src.stop(t + seconds + 0.05)
    return src
  }

  /** Clique seco de slide. Estrangulado para não virar metralhadora. */
  click() {
    if (!this.ready || this.muted) return
    const now = performance.now()
    if (now - this.lastClick < 90) return
    this.lastClick = now

    const ctx = this.ctx
    const t = ctx.currentTime
    const src = ctx.createBufferSource()
    src.buffer = this.noiseBuf
    const filter = ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 2200
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.16, t)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start(t)
    src.stop(t + 0.06)
  }

  dispose() {
    try {
      this.ctx?.close()
    } catch {
      // contexto já fechado
    }
    this.ctx = null
    this.ready = false
  }
}

/** Instância única: qualquer componente chama sem precisar de contexto React. */
export const sfx = new Soundtrack()
