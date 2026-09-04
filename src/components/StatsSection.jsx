import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createSky } from './skyScene.js'
import './StatsSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Números monumentais, sobre o céu dourado.
 *
 * Esta é a única seção clara do site, e é de propósito: doze capítulos
 * seguidos no escuro achatam a percepção, e um respiro luminoso no meio faz
 * o vinho voltar a pesar quando o site escurece de novo. O céu é o mesmo
 * clipe da intro — o material que abriu a experiência volta como ambiente,
 * fechando um laço em vez de introduzir um asset novo.
 *
 * Nada de quatro cards lado a lado: cada número ocupa a tela sozinho, e o
 * primeiro é preenchido pelo vídeo — o algarismo é uma janela, não um texto
 * colorido. Os contadores sobem com o scroll, não com um timer.
 *
 * Os valores vieram do briefing. Os dois últimos aparecem lá como exemplo de
 * layout, então estão marcados para você confirmar antes de ir ao ar.
 */
const STATS = [
  { value: 5, suffix: 'BI+', label: 'streams', decimals: 0 },
  { value: 12, suffix: 'MI', label: 'ouvintes mensais', decimals: 0, confirm: true },
  { value: 50, prefix: 'TOP ', suffix: '', label: 'global', decimals: 0, confirm: true },
  { value: 30, prefix: 'UNDER ', suffix: '', label: 'Forbes', decimals: 0 },
]

export default function StatsSection() {
  const rootRef = useRef(null)
  const skyRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      root.querySelectorAll('.evom-stats__item').forEach((item) => {
        const num = item.querySelector('.evom-stats__num-value')
        const target = Number(num.dataset.value)
        const counter = { v: 0 }

        gsap
          .timeline({
            scrollTrigger: { trigger: item, start: 'top 82%', end: 'top 32%', scrub: 0.7 },
          })
          // O contador é scrubado: subir o número por timer faria o usuário
          // perder a contagem se chegasse tarde ou rolasse de volta.
          .to(
            counter,
            {
              v: target,
              ease: 'none',
              onUpdate: () => {
                num.textContent = Math.round(counter.v).toLocaleString('pt-BR')
              },
            },
            0
          )
          .fromTo(item, { autoAlpha: 0.15, y: 60 }, { autoAlpha: 1, y: 0, ease: 'power2.out' }, 0)

        // Parallax do rótulo: entra mais devagar que o número, criando camada.
        gsap.to(item.querySelector('.evom-stats__label'), {
          yPercent: -26,
          ease: 'none',
          scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: 1 },
        })
      })
    }, root)

    // O céu: renderiza só enquanto a seção está na tela, e o sol sobe com o
    // progresso do scroll.
    const sky = createSky(skyRef.current)
    let st = null
    if (sky) {
      st = ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => sky.setProgress(self.progress),
        onToggle: (self) => (self.isActive ? sky.start() : sky.stop()),
      })
      if (st.isActive) sky.start()
    }

    return () => {
      st?.kill()
      sky?.dispose()
      ctx.revert()
    }
  }, [])

  return (
    <section ref={rootRef} className="evom-stats" aria-label="Números">
      {/* O céu vive DENTRO da seção: wrapper absoluto do tamanho dela, com o
          canvas em sticky por dentro. A versão anterior usava position: fixed
          e o céu vazou para a página inteira — fixed se prende à viewport, e o
          clip-path que eu tinha posto estava no próprio elemento fixo, onde
          não contém nada. */}
      <div className="evom-stats__skywrap" aria-hidden="true">
        <canvas ref={skyRef} className="evom-stats__sky" />
        <span className="evom-stats__haze" />
      </div>

      {STATS.map((s) => (
        <div className="evom-stats__item" key={s.label}>
          <p className="evom-stats__num">
            <span className="evom-stats__num-text">
              {s.prefix}
              <span className="evom-stats__num-value" data-value={s.value}>
                0
              </span>
              {s.suffix}
            </span>
          </p>
          <p className="evom-stats__label">{s.label}</p>
        </div>
      ))}
    </section>
  )
}
