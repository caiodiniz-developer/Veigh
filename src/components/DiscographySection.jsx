import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CAPAS } from '../assets.js'
import './DiscographySection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Discografia horizontal.
 *
 * O usuário continua rolando para baixo, mas o que se move é o eixo X: a
 * seção fica presa e a fita de discos anda lateralmente. Mecânica nova de
 * novo — nenhum outro capítulo converte scroll vertical em deslocamento
 * horizontal.
 *
 * Cada disco é uma capa saindo de uma "manga": a arte desliza para fora do
 * sulco quando chega ao centro, que é o gesto de tirar um vinil da capa.
 */
const DISCS = [
  {
    year: '2022',
    title: 'DOS PRÉDIOS',
    cover: CAPAS.dosPredios,
    note: 'O primeiro álbum. O disco de trap nacional mais ouvido do Brasil.',
  },
  {
    year: '2023',
    title: 'NOVO BALANÇO',
    cover: CAPAS.novoBalanco,
    note: 'O nome sai dos prédios e atravessa o cenário.',
  },
  {
    year: '2024',
    title: 'DOS PRÉDIOS DELUXE',
    cover: CAPAS.dosPrediosDeluxe,
    note: 'O prédio ficou pequeno.',
  },
  {
    year: '2025',
    title: 'EU VENCI O MUNDO',
    cover: CAPAS.euVenciOMundo,
    note: 'A frase deixa de ser ambição e vira título.',
  },
]

export default function DiscographySection() {
  const rootRef = useRef(null)
  const tapeRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    const tape = tapeRef.current
    if (!root || !tape) return

    const ctx = gsap.context(() => {
      // A distância a percorrer depende da largura real da fita, então é
      // calculada por função e reavaliada no refresh — em vez de um valor fixo
      // que quebraria em qualquer largura diferente da de desenvolvimento.
      const distance = () => Math.max(0, tape.scrollWidth - window.innerWidth * 0.92)

      gsap.to(tape, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => '+=' + distance(),
          scrub: 0.7,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      // Cada disco reage ao próprio momento de centralidade. containerAnimation
      // é o que permite um ScrollTrigger enxergar um elemento que se move na
      // horizontal por causa de outro ScrollTrigger.
      const horizontal = ScrollTrigger.getById?.('evom-disc') || null
      void horizontal

      tape.querySelectorAll('.evom-disc__item').forEach((item) => {
        const art = item.querySelector('.evom-disc__art')
        const meta = item.querySelector('.evom-disc__meta')
        gsap
          .timeline({
            scrollTrigger: {
              trigger: item,
              containerAnimation: gsap.getTweensOf(tape)[0],
              start: 'left 78%',
              end: 'right 30%',
              scrub: 0.6,
            },
          })
          .fromTo(art, { scale: 0.86, rotate: -2.5 }, { scale: 1, rotate: 0, ease: 'power1.out' }, 0)
          .fromTo(meta, { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, ease: 'power2.out' }, 0.1)
      })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={rootRef} className="evom-disc" aria-label="Discografia">
      <div className="evom-disc__stage">
        <header className="evom-disc__head">
          <p className="evom-disc__eyebrow">Discografia</p>
        </header>

        <div ref={tapeRef} className="evom-disc__tape">
          {DISCS.map((d) => (
            <article className="evom-disc__item" key={d.title}>
              <div className="evom-disc__art">
                {/* O vinil que assoma por trás da capa. Feito em CSS: um
                    disco de 447px não existe no projeto, e desenhar o sulco
                    com gradiente cônico sai mais nítido que qualquer bitmap. */}
                <span className="evom-disc__vinyl" aria-hidden="true" />
                <img src={d.cover} alt={`Capa de ${d.title}`} loading="lazy" decoding="async" />
              </div>

              <div className="evom-disc__meta">
                <p className="evom-disc__year">{d.year}</p>
                <h3 className="evom-disc__title">{d.title}</h3>
                <p className="evom-disc__note">{d.note}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
