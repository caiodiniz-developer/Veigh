import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CAPAS, ERA } from '../assets.js'
import { readMotionMode, CALM } from '../motion.js'
import { createRoadTimeline } from './roadTimeline.js'
import './TimelineSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * A trajetória, percorrida como estrada.
 *
 * A cena é WebGL (asfalto, anos pintados no chão, fotos de pé nas margens) e a
 * legenda de cada era é HTML por cima — tipografia nítida em qualquer tela.
 *
 * A luz conta a história junto: fria em 2022, dourada em 2023, vinho em 2024,
 * rubi em 2025, quase branca no agora. A cor corrente sai da cena e é escrita
 * numa custom property na seção, então o HTML por cima se tinge com a mesma luz
 * do asfalto — uma paleta só governando as duas camadas.
 *
 * Os anos e os textos são os mesmos da versão anterior: mudou a apresentação,
 * não o conteúdo.
 */
const ENTRIES = [
  {
    year: '2022',
    title: 'DOS PRÉDIOS',
    text: 'Os prédios onde cresceu em Itapevi viram o nome do primeiro álbum. O disco de trap nacional mais ouvido do Brasil.',
    cover: CAPAS.dosPredios,
    photos: [ERA.dosPredios[0], ERA.dosPredios[3]],
  },
  {
    year: '2023',
    title: 'NOVO BALANÇO',
    text: 'O nome sai dos prédios. As colaborações começam a atravessar o cenário.',
    cover: CAPAS.novoBalanco,
    photos: [ERA.dosPredios[5], ERA.dosPrediosDeluxe[0]],
  },
  {
    // Ano ainda pendente: o briefing não informou a data do Deluxe.
    year: '2024',
    title: 'DOS PRÉDIOS DELUXE',
    text: 'O prédio ficou pequeno. A fotografia deixa de ser rua e começa a ser ascensão.',
    cover: CAPAS.dosPrediosDeluxe,
    photos: [ERA.dosPrediosDeluxe[1], ERA.dosPrediosDeluxe[3]],
  },
  {
    year: '2025',
    title: 'EU VENCI O MUNDO',
    text: 'O capítulo em que a frase deixa de ser ambição e vira título.',
    cover: CAPAS.euVenciOMundo,
    photos: [ERA.euVenciOMundo[0], ERA.euVenciOMundo[2]],
  },
  {
    year: 'AGORA',
    title: '5 BILHÕES DE STREAMS',
    text: 'Capa da Forbes Under 30.',
    photos: [ERA.euVenciOMundo[3], ERA.euVenciOMundo[4]],
  },
]

export default function TimelineSection({ height = '620vh', respectReducedMotion = true }) {
  const [reduced] = useState(() => respectReducedMotion && readMotionMode() === CALM)

  const rootRef = useRef(null)
  const canvasRef = useRef(null)
  const cardsRef = useRef([])

  useEffect(() => {
    const root = rootRef.current
    if (!root || reduced) return

    let road = null
    let cancelled = false
    let st = null

    createRoadTimeline(canvasRef.current, ENTRIES).then((scene) => {
      if (cancelled || !scene) return
      road = scene

      st = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.7,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const out = road.setProgress(self.progress)
          if (out) root.style.setProperty('--evom-era-light', out.light)
        },
        // O tráfego e as janelas correm no tempo, então a cena precisa de
        // loop — mas só enquanto a estrada está na tela.
        onToggle: (self) => (self.isActive ? road.start() : road.stop()),
      })

      road.setProgress(st.progress)
      if (st.isActive) road.start()
      ScrollTrigger.refresh()
    })

    const ctx = gsap.context(() => {
      // UMA timeline para todas as legendas, com duração travada em 1.
      //
      // A versão anterior criava uma timeline por card. Cada timeline tem a
      // duração definida pelo próprio conteúdo — a do primeiro card terminava
      // em 0.29, a do último em 1.09 — e o scrub estica CADA uma sobre o
      // scroll inteiro. Resultado: as legendas desalinhavam do ano na pista e,
      // no fim, as cinco apareciam juntas. O espaçador abaixo fixa a duração
      // em exatamente 1, então posição na timeline = progresso do scroll.
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      })
      tl.to({}, { duration: 1 }, 0) // espaçador: trava a duração total em 1

      const seg = 1 / ENTRIES.length
      cardsRef.current.filter(Boolean).forEach((card, i) => {
        const at = i * seg
        tl.fromTo(
          card,
          { autoAlpha: 0, y: 34 },
          { autoAlpha: 1, y: 0, duration: seg * 0.26, ease: 'power2.out' },
          at + seg * 0.14
        )
        tl.to(
          card,
          { autoAlpha: 0, y: -34, duration: seg * 0.22, ease: 'power2.in' },
          at + seg * 0.72
        )
      })
    }, root)

    return () => {
      cancelled = true
      st?.kill()
      ctx.revert()
      road?.dispose()
    }
  }, [reduced])

  return (
    <section
      ref={rootRef}
      className={`evom-tl${reduced ? ' is-static' : ''}`}
      style={{ height: reduced ? 'auto' : height }}
      aria-label="Linha do tempo da carreira"
    >
      <div className="evom-tl__stage">
        <canvas ref={canvasRef} className="evom-tl__canvas" aria-hidden="true" />

        <p className="evom-tl__eyebrow">A trajetória</p>

        <div className="evom-tl__cards">
          {ENTRIES.map((e, i) => (
            <article
              className="evom-tl__card"
              key={e.year}
              ref={(el) => {
                cardsRef.current[i] = el
              }}
            >
              <p className="evom-tl__year">{e.year}</p>
              <h3 className="evom-tl__name">{e.title}</h3>
              <p className="evom-tl__desc">{e.text}</p>
            </article>
          ))}
        </div>
      </div>

      {/* Sem WebGL ou com movimento reduzido, a trajetória continua legível
          como documento: os mesmos anos, títulos e textos, empilhados. */}
      <ol className="evom-tl__fallback">
        {ENTRIES.map((e) => (
          <li key={e.year}>
            <p className="evom-tl__year">{e.year}</p>
            <h3 className="evom-tl__name">{e.title}</h3>
            <p className="evom-tl__desc">{e.text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
