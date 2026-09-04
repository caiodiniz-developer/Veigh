import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CAPAS, ERA } from '../assets.js'
import './TimelineSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Timeline da carreira.
 *
 * Mecânica deliberadamente diferente dos capítulos anteriores: intro, manifesto
 * e história usam palco sticky com o conteúdo parado e o scroll movendo a
 * timeline. Aqui é o inverso — o conteúdo rola de verdade e só o trilho do
 * tempo fica preso, se preenchendo conforme a página desce. É o que faz a
 * seção parecer uma passagem de tempo em vez de mais um palco.
 *
 * As fotos entram como fotografias soltas, levemente tortas e em velocidades
 * diferentes das legendas — a profundidade vem do descompasso, não de efeito.
 */

// Os anos vêm do briefing (2022 Dos Prédios, 2023 Novo Balanço, 2025 Eu Venci o
// Mundo). O ano do Deluxe não foi informado em lugar nenhum: está marcado como
// pendente de confirmação em vez de chutado — trocar aqui é uma linha.
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
    photos: [ERA.dosPredios[5]],
  },
  {
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
    photos: [ERA.euVenciOMundo[3]],
  },
]

export default function TimelineSection({ respectReducedMotion = true }) {
  const [reduced] = useState(() => {
    if (!respectReducedMotion || typeof window === 'undefined') return false
    if (new URLSearchParams(window.location.search).get('motion') === 'full') return false
    return (
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
  })

  const rootRef = useRef(null)
  const railFillRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root || reduced) return

    const ctx = gsap.context(() => {
      // O trilho se preenche ao longo da seção inteira. scaleY em vez de height:
      // altura dispararia layout a cada frame de scroll.
      gsap.fromTo(
        railFillRef.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: root,
            start: 'top 60%',
            end: 'bottom 80%',
            scrub: 0.5,
          },
        }
      )

      // Cada entrada tem o seu próprio gatilho, com range curto e bem definido —
      // nenhum deles recalcula nada fora da própria faixa de scroll.
      root.querySelectorAll('.evom-tl__entry').forEach((entry) => {
        const marker = entry.querySelector('.evom-tl__marker')
        const year = entry.querySelector('.evom-tl__year')
        const copy = entry.querySelector('.evom-tl__copy')
        const media = entry.querySelectorAll('.evom-tl__shot')

        gsap
          .timeline({
            scrollTrigger: { trigger: entry, start: 'top 88%', end: 'top 42%', scrub: 0.6 },
          })
          .fromTo(marker, { scale: 0.2, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.4 }, 0)
          .fromTo(year, { autoAlpha: 0, xPercent: -8 }, { autoAlpha: 1, xPercent: 0, duration: 0.6 }, 0.05)
          .fromTo(copy, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 0.15)
          .fromTo(
            media,
            { autoAlpha: 0, y: 60, rotate: (i) => (i % 2 ? 3.5 : -2.5) },
            {
              autoAlpha: 1,
              y: 0,
              rotate: (i) => (i % 2 ? 2 : -1.5),
              duration: 0.8,
              stagger: 0.12,
            },
            0.1
          )

        // Parallax: as fotos continuam subindo depois de entrarem, mais devagar
        // que a página. É o descompasso que dá profundidade.
        media.forEach((shot, i) => {
          gsap.to(shot, {
            yPercent: -8 - i * 4,
            ease: 'none',
            scrollTrigger: { trigger: entry, start: 'top bottom', end: 'bottom top', scrub: 1 },
          })
        })
      })
    }, root)

    return () => ctx.revert()
  }, [reduced])

  return (
    <section
      ref={rootRef}
      className={`evom-tl${reduced ? ' is-static' : ''}`}
      aria-label="Linha do tempo da carreira"
    >
      <header className="evom-tl__head">
        <p className="evom-tl__eyebrow">A trajetória</p>
        <h2 className="evom-tl__title">
          DOS PRÉDIOS
          <br />
          ATÉ AQUI.
        </h2>
      </header>

      <div className="evom-tl__rail" aria-hidden="true">
        <span ref={railFillRef} className="evom-tl__rail-fill" />
      </div>

      <ol className="evom-tl__list">
        {ENTRIES.map((entry) => (
          <li className="evom-tl__entry" key={entry.year}>
            <span className="evom-tl__marker" aria-hidden="true" />

            <div className="evom-tl__text">
              <p className="evom-tl__year">{entry.year}</p>
              <div className="evom-tl__copy">
                <h3 className="evom-tl__name">{entry.title}</h3>
                <p className="evom-tl__desc">{entry.text}</p>
              </div>
            </div>

            <div className="evom-tl__media">
              {entry.cover && (
                <figure className="evom-tl__shot evom-tl__shot--cover">
                  <img src={entry.cover} alt={`Capa de ${entry.title}`} decoding="async" />
                  <figcaption>{entry.title}</figcaption>
                </figure>
              )}
              {entry.photos?.map((src, i) => (
                <figure className="evom-tl__shot" key={src}>
                  <img src={src} alt="" loading="lazy" decoding="async" aria-hidden="true" />
                  <figcaption>{entry.year}</figcaption>
                </figure>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
