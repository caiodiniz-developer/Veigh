import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SHOWS } from '../assets.js'
import './ShowsSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Shows — a seção começa no escuro e o scroll acende o palco.
 *
 * A ordem importa: primeiro o breu, depois os feixes de luz varrendo, depois
 * a multidão ao fundo, e só então as fotos em primeiro plano. É a sequência de
 * abertura de um show, e é o que diferencia esta seção de uma galeria — aqui a
 * fotografia é a última coisa a aparecer, não a primeira.
 *
 * As fotos entram em três profundidades com velocidades diferentes; o
 * descompasso é o que dá volume ao palco.
 */
const DEPTHS = [0.28, 0.62, 1, 0.45, 0.86, 0.35] // uma por foto

export default function ShowsSection() {
  const rootRef = useRef(null)

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
          scrub: 0.7,
          invalidateOnRefresh: true,
        },
      })

      // 1. os feixes acendem
      tl.fromTo(
        root.querySelectorAll('.evom-shows__beam'),
        { autoAlpha: 0, scaleY: 0.3 },
        { autoAlpha: 1, scaleY: 1, duration: 0.22, stagger: 0.05, ease: 'power2.out' },
        0.05
      )

      // 2. o texto assume a tela
      tl.fromTo(
        root.querySelector('.evom-shows__title'),
        { autoAlpha: 0, y: 50 },
        { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out' },
        0.16
      )

      // 3. as fotos sobem, cada profundidade no seu tempo
      root.querySelectorAll('.evom-shows__shot').forEach((shot, i) => {
        const depth = DEPTHS[i % DEPTHS.length]
        tl.fromTo(
          shot,
          { autoAlpha: 0, y: 120 * depth + 60, scale: 0.9 },
          { autoAlpha: 1, y: 0, scale: 1, duration: 0.3, ease: 'power2.out' },
          0.3 + i * 0.055
        )

        // Parallax contínuo por profundidade: as do fundo andam menos.
        gsap.to(shot, {
          yPercent: -18 * depth,
          ease: 'none',
          scrollTrigger: { trigger: root, start: 'top bottom', end: 'bottom top', scrub: 1.1 },
        })
      })

      // 4. a luz geral sobe por último, revelando o conjunto
      tl.fromTo(
        root.querySelector('.evom-shows__glow'),
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.3 },
        0.34
      )
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={rootRef} className="evom-shows" aria-label="Shows">
      <div className="evom-shows__stage">
        <div className="evom-shows__glow" aria-hidden="true" />

        <div className="evom-shows__beams" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span className="evom-shows__beam" key={i} style={{ '--i': i }} />
          ))}
        </div>

        <h2 className="evom-shows__title">
          DOS PRÉDIOS
          <br />
          <span>PARA OS PALCOS.</span>
        </h2>

        <div className="evom-shows__gallery">
          {SHOWS.map((src, i) => (
            <figure
              className="evom-shows__shot"
              key={src}
              style={{ '--depth': DEPTHS[i % DEPTHS.length] }}
            >
              <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
