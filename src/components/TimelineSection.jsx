import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CAPAS, TRAJETORIA } from '../assets.js'
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
    figuras: TRAJETORIA.dosPredios,
  },
  {
    year: '2023',
    title: 'NOVO BALANÇO',
    text: 'O nome sai dos prédios. As colaborações começam a atravessar o cenário.',
    cover: CAPAS.novoBalanco,
    figuras: TRAJETORIA.novoBalanco,
  },
  {
    // Ano ainda pendente: o briefing não informou a data do Deluxe.
    year: '2024',
    title: 'DOS PRÉDIOS DELUXE',
    text: 'O prédio ficou pequeno. A fotografia deixa de ser rua e começa a ser ascensão.',
    cover: CAPAS.dosPrediosDeluxe,
    figuras: TRAJETORIA.dosPrediosDeluxe,
  },
  {
    year: '2025',
    title: 'EU VENCI O MUNDO',
    text: 'O capítulo em que a frase deixa de ser ambição e vira título.',
    cover: CAPAS.euVenciOMundo,
    figuras: TRAJETORIA.euVenciOMundo,
  },
  {
    // Sem figura: existem quatro pares de recorte, um por disco, e "AGORA" não
    // é um disco. Repetir o par do EVOM logo depois dele mesmo entregaria a
    // repetição na hora — o trecho final é a estrada se abrindo, com a cidade
    // ficando para trás.
    year: 'AGORA',
    title: '5 BILHÕES DE STREAMS',
    text: 'Capa da Forbes Under 30.',
    figuras: null,
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

    createRoadTimeline(canvasRef.current, ENTRIES, {
      predio: TRAJETORIA.predio,
      carro: TRAJETORIA.carro,
    }).then((scene) => {
      if (cancelled || !scene) return
      road = scene
      // Sonda de custo em desenvolvimento. A cena carrega dois modelos pesados
      // (o carro tem 414 mil triângulos), e a única forma honesta de saber o
      // que ela desenha por quadro é perguntar ao renderer em vez de estimar.
      if (import.meta.env.DEV) window.__evomRoad = scene

      st = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        // Amortecimento alto de propósito: a câmera persegue o scroll em vez
        // de ser arrastada por ele quadro a quadro. É o que tira o serrilhado
        // do movimento numa cena com 2,5 milhões de triângulos, onde qualquer
        // quadro perdido aparece como salto.
        scrub: 1.3,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const out = road.setProgress(self.progress)
          if (!out) return
          root.style.setProperty('--evom-era-light', out.light)

          // Cada legenda vai para o lado da sua figura.
          //
          // O card continua sendo HTML por cima do canvas — tipografia nítida
          // vale mais que texto em textura — mas deixa de morar num canto
          // fixo. A cena devolve a posição de tela de cada figura e o bloco de
          // texto se ancora nela.
          //
          // left/top e não transform: o GSAP já usa transform para animar a
          // entrada e a saída de cada card, e escrever nos dois lugares faria
          // um sobrescrever o outro a cada quadro.
          const cards = cardsRef.current
          for (const m of out.marcas || []) {
            const card = cards[m.era]
            if (!card) continue
            if (m.dentro) {
              card.style.left = m.x + 'px'
              card.style.top = m.y + 'px'
            } else {
              // Fora do quadro: volta para a âncora de repouso do CSS.
              // Limpando SÓ left e top — removeAttribute('style') apagaria
              // junto opacity, visibility e transform, que são do GSAP, e o
              // card piscaria a cada quadro em que a figura saísse de cena.
              card.style.left = ''
              card.style.top = ''
            }
          }
        },
        // O tráfego e as janelas correm no tempo, então a cena precisa de
        // loop — mas só enquanto a estrada está na tela.
        onToggle: (self) => (self.isActive ? road.start() : road.stop()),
      })

      montarLegendas(scene.janelas)
      road.setProgress(st.progress)
      if (st.isActive) road.start()
      ScrollTrigger.refresh()
    })

    // A timeline das legendas nasce só depois da cena, e não em paralelo.
    //
    // Ela precisa das JANELAS que a cena calcula: em que trecho do scroll cada
    // figura está à frente da câmera. Sem isso a única opção era dividir o
    // percurso em fatias iguais — um quinto por era — e o resultado era o
    // texto entrando quando a câmera já tinha passado pela foto, apontando
    // para um ponto atrás do observador.
    let ctx = null
    const montarLegendas = (janelas) => {
      ctx = gsap.context(() => {
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1.1,
            invalidateOnRefresh: true,
          },
        })
        // Espaçador: trava a duração total em 1, então posição na timeline
        // passa a ser progresso de scroll. Sem ele cada tween estica sobre o
        // percurso inteiro e as cinco legendas terminam aparecendo juntas.
        tl.to({}, { duration: 1 }, 0)

        cardsRef.current.filter(Boolean).forEach((card, i) => {
          const j = janelas[i]
          if (!j) return
          const largura = Math.max(j.fim - j.inicio, 0.02)
          tl.fromTo(
            card,
            { autoAlpha: 0, y: 34 },
            { autoAlpha: 1, y: 0, duration: largura * 0.3, ease: 'power2.out' },
            j.inicio
          )
          tl.to(
            card,
            { autoAlpha: 0, y: -34, duration: largura * 0.25, ease: 'power2.in' },
            j.fim - largura * 0.22
          )
        })
      }, root)
    }

    return () => {
      cancelled = true
      st?.kill()
      ctx?.revert()
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
