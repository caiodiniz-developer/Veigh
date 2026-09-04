import { useEffect, useRef } from 'react'
import './AtmosphereLayer.css'

/**
 * Duas camadas globais: o relógio de luz e o borrão por velocidade.
 *
 * RELÓGIO DE LUZ. Hoje cada capítulo tem a luz dele e nada costura os treze.
 * Esta camada é uma única luz governando o site inteiro: noite nos prédios,
 * alvorada na trajetória, golden hour nos números, noite de novo no palco,
 * quase branco no fim. O scroll vira a passagem de um dia.
 *
 * A tinta é fraca de propósito (no máximo 18% de opacidade). A direção de arte
 * de cada seção continua mandando — o relógio só dá a elas um denominador
 * fotográfico comum, do jeito que uma correção de cor faz num filme sem
 * apagar a fotografia de cada cena.
 *
 * BORRÃO POR VELOCIDADE. backdrop-filter num painel fixo desfoca o que está
 * atrás — é borrão de verdade da página composta, não uma imitação com
 * gradiente. Rolar rápido borra, parar cristaliza.
 */

// Paradas do dia, na ordem do documento. Posição (0-1) e cor.
const DAY = [
  { at: 0.0, color: [10, 14, 28] }, // noite fria: a intro
  { at: 0.12, color: [16, 8, 16] }, // madrugada
  { at: 0.22, color: [46, 44, 78] }, // alvorada: a estrada
  { at: 0.32, color: [22, 6, 14] }, // volta ao escuro: o disco
  { at: 0.44, color: [58, 22, 30] }, // interior quente: o player
  { at: 0.54, color: [214, 156, 92] }, // golden hour: os números
  { at: 0.64, color: [150, 118, 96] }, // tarde alta: discografia e mesa
  { at: 0.76, color: [26, 8, 16] }, // noite: a sala e o palco
  { at: 0.88, color: [14, 18, 40] }, // espaço frio: o planeta
  { at: 1.0, color: [226, 214, 206] }, // quase branco: o fim
]

const lerp = (a, b, t) => a + (b - a) * t

function dayColor(p) {
  const t = Math.min(Math.max(p, 0), 1)
  let i = 0
  while (i < DAY.length - 2 && DAY[i + 1].at < t) i++
  const a = DAY[i]
  const b = DAY[i + 1]
  const k = (t - a.at) / Math.max(b.at - a.at, 0.0001)
  const c = a.color.map((v, n) => Math.round(lerp(v, b.color[n], Math.min(Math.max(k, 0), 1))))
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

const MAX_BLUR = 4.2 // px. Acima disso a página some em vez de borrar.
const VEL_FULL = 2600 // px/s que corresponde ao borrão cheio

export default function AtmosphereLayer() {
  const tintRef = useRef(null)
  const blurRef = useRef(null)

  useEffect(() => {
    const tint = tintRef.current
    const blur = blurRef.current
    if (!tint || !blur) return

    let lastY = window.scrollY
    let lastT = performance.now()
    let vel = 0
    let raf = 0
    let pending = false
    let blurring = false

    const apply = () => {
      pending = false
      const now = performance.now()
      const y = window.scrollY
      const dt = Math.max(now - lastT, 1)

      // Velocidade em px/s, suavizada. Sem a suavização o borrão pisca a cada
      // micro-variação da roda do mouse.
      const raw = (Math.abs(y - lastY) / dt) * 1000
      vel = vel * 0.72 + raw * 0.28
      lastY = y
      lastT = now

      // ---- relógio de luz ----
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? y / max : 0
      tint.style.backgroundColor = dayColor(p)

      // ---- borrão ----
      const amount = Math.min(vel / VEL_FULL, 1)
      if (amount > 0.06) {
        if (!blurring) {
          blurring = true
          blur.classList.add('is-active')
        }
        blur.style.setProperty('--evom-blur', (amount * MAX_BLUR).toFixed(2) + 'px')
        blur.style.setProperty('--evom-streak', (amount * 0.16).toFixed(3))
      } else if (blurring) {
        // Desliga a classe em vez de zerar o valor: backdrop-filter continua
        // custando uma passada de composição mesmo com raio zero.
        blurring = false
        blur.classList.remove('is-active')
        blur.style.setProperty('--evom-blur', '0px')
        blur.style.setProperty('--evom-streak', '0')
      }

      // Continua amostrando enquanto houver inércia, senão o borrão fica preso
      // no último valor quando o scroll para de emitir eventos.
      if (vel > 12) {
        raf = requestAnimationFrame(apply)
        pending = true
      }
    }

    const onScroll = () => {
      if (pending) return
      pending = true
      raf = requestAnimationFrame(apply)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    apply()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <>
      <div ref={tintRef} className="evom-daylight" aria-hidden="true" />
      <div ref={blurRef} className="evom-motion" aria-hidden="true">
        <span className="evom-motion__streak" />
      </div>
    </>
  )
}
