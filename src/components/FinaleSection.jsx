import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { VIDEOS } from '../assets.js'
import './FinaleSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Encerramento — fecha a narrativa aberta na intro.
 *
 * O vídeo do Veigh vai escurecendo enquanto as quatro frases passam, e no fim
 * fica só a assinatura e o convite. É o único ponto do site com CTA: colocá-lo
 * antes quebraria a leitura de filme que o resto sustenta.
 */
const LINES = ['DOS PRÉDIOS.', 'PARA O BRASIL.', 'DO BRASIL.', 'PARA O MUNDO.']

export default function FinaleSection({ height = '460vh' }) {
  const rootRef = useRef(null)
  const linesRef = useRef([])

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
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      })

      // A imagem escurece devagar ao longo de todo o percurso.
      tl.fromTo(
        root.querySelector('.evom-finale__scrim'),
        { autoAlpha: 0.25 },
        { autoAlpha: 0.92, duration: 0.78 },
        0
      )

      // Uma frase por vez, cada uma ocupando a tela sozinha.
      const seg = 0.17
      linesRef.current.filter(Boolean).forEach((el, i) => {
        tl.fromTo(el, { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: seg * 0.4 }, i * seg)
        tl.to(el, { autoAlpha: 0, y: -40, duration: seg * 0.35 }, i * seg + seg * 0.6)
      })

      // Assinatura e CTA, depois de uma pausa visual.
      tl.fromTo(
        root.querySelector('.evom-finale__signature'),
        { autoAlpha: 0, y: 40 },
        { autoAlpha: 1, y: 0, duration: 0.12 },
        0.78
      )
      tl.fromTo(
        root.querySelector('.evom-finale__cta'),
        { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, duration: 0.08 },
        0.88
      )
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={rootRef} className="evom-finale" style={{ height }} aria-label="Eu Venci o Mundo">
      <div className="evom-finale__stage">
        <video
          className="evom-finale__video"
          src={VIDEOS.sessao1}
          poster={VIDEOS.sessao1Poster}
          muted
          loop
          playsInline
          autoPlay
          preload="metadata"
          aria-hidden="true"
        />
        <div className="evom-finale__scrim" aria-hidden="true" />

        <div className="evom-finale__lines">
          {LINES.map((line, i) => (
            <p
              className="evom-finale__line"
              key={line}
              ref={(el) => {
                linesRef.current[i] = el
              }}
            >
              {line}
            </p>
          ))}
        </div>

        <div className="evom-finale__signature">
          <p className="evom-finale__name">VEIGH</p>
          <p className="evom-finale__album">
            EU VENCI
            <br />O MUNDO.
          </p>
        </div>

        {/* Sem link inventado: o destino real (Spotify, Apple) precisa vir de
            você. O botão existe e é claramente clicável — só falta o href. */}
        <p className="evom-finale__cta">
          <span>OUÇA AGORA</span>
          <span aria-hidden="true">&#8599;</span>
        </p>
      </div>
    </section>
  )
}
