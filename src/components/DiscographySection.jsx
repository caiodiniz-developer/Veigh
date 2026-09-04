import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CAPAS } from '../assets.js'
import './DiscographySection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Discografia — a caixa de disco.
 *
 * Antes era scroll horizontal com as capas de pé, uma ao lado da outra. Agora
 * é uma caixa de loja: as capas empilhadas inclinadas para trás, e o scroll
 * FOLHEIA uma de cada vez para a frente — o gesto de garimpar vinil.
 *
 * O gesto é o ponto. Ninguém folheia discos deslizando de lado; folheia
 * puxando a capa da frente e deixando cair. Ao reproduzir isso, a seção passa
 * a falar a língua do assunto em vez de usar o carrossel genérico.
 *
 * Tudo em CSS 3D: as capas existem num espaço com perspectiva e o que muda por
 * disco é rotação em X, deslocamento em Z e altura. Nada de WebGL — a cena tem
 * quatro objetos, e três transformações resolvem.
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

export default function DiscographySection({ height = '420vh' }) {
  const rootRef = useRef(null)
  const cardsRef = useRef([])
  const metaRef = useRef([])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.65,
          invalidateOnRefresh: true,
        },
      })
      // Espaçador travando a duração em 1: posição na timeline vira progresso
      // de scroll. Sem ele a duração vem do conteúdo e tudo escorrega.
      tl.to({}, { duration: 1 }, 0)

      const seg = 1 / DISCS.length

      cardsRef.current.filter(Boolean).forEach((card, i) => {
        const at = i * seg

        // Estado inicial: recostado na caixa, atrás dos que vieram antes.
        gsap.set(card, {
          // -52 e não -68: a 68 graus a capa fica quase de perfil e vira uma
          // tira fina, sem arte visível. Disco recostado numa caixa mostra a
          // capa, é para isso que ele está inclinado e não deitado.
          rotateX: -52,
          y: -i * 8,
          z: -i * 66,
          scale: 1 - i * 0.03,
          autoAlpha: i === 0 ? 1 : 0.55,
        })

        // Levanta: a capa vem para a vertical e para a frente da caixa.
        tl.to(
          card,
          { rotateX: 0, z: 0, y: 0, scale: 1, autoAlpha: 1, duration: seg * 0.5, ease: 'power2.out' },
          at
        )

        // E cai para a frente, saindo do caminho da próxima — o disco folheado
        // não some, ele tomba na sua direção e passa por baixo do quadro.
        if (i < DISCS.length - 1) {
          tl.to(
            card,
            { rotateX: 82, y: 220, z: 340, autoAlpha: 0, duration: seg * 0.42, ease: 'power2.in' },
            at + seg * 0.58
          )
        }
      })

      metaRef.current.filter(Boolean).forEach((meta, i) => {
        const at = i * seg
        tl.fromTo(
          meta,
          { autoAlpha: 0, y: 26 },
          { autoAlpha: 1, y: 0, duration: seg * 0.3, ease: 'power2.out' },
          at + seg * 0.16
        )
        if (i < DISCS.length - 1) {
          tl.to(meta, { autoAlpha: 0, y: -26, duration: seg * 0.24, ease: 'power2.in' }, at + seg * 0.66)
        }
      })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={rootRef} className="evom-disc" style={{ height }} aria-label="Discografia">
      <div className="evom-disc__stage">
        <p className="evom-disc__eyebrow">Discografia</p>

        {/* A caixa. A perspectiva vive aqui para todas as capas dividirem o
            mesmo ponto de fuga — perspectiva por card faria cada uma ter a sua
            câmera, e a pilha deixaria de ler como uma pilha. */}
        <div className="evom-disc__crate">
          <span className="evom-disc__crate-front" aria-hidden="true" />

          {DISCS.map((d, i) => (
            <div
              className="evom-disc__card"
              key={d.title}
              ref={(el) => {
                cardsRef.current[i] = el
              }}
              style={{ zIndex: DISCS.length - i }}
            >
              <img src={d.cover} alt={`Capa de ${d.title}`} loading="lazy" decoding="async" />
              <span className="evom-disc__sleeve" aria-hidden="true" />
            </div>
          ))}
        </div>

        <div className="evom-disc__metas">
          {DISCS.map((d, i) => (
            <div
              className="evom-disc__meta"
              key={d.title}
              ref={(el) => {
                metaRef.current[i] = el
              }}
            >
              <p className="evom-disc__year">{d.year}</p>
              <h3 className="evom-disc__title">{d.title}</h3>
              <p className="evom-disc__note">{d.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
