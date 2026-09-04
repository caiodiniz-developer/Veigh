import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CLIPES } from '../assets.js'
import './ClipsSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Clipes — fita horizontal de frames.
 *
 * Nada de card de YouTube: cada clipe é um frame de película que começa
 * parado e ganha vida no hover (o vídeo toca ali mesmo, mudo). Ao clicar, o
 * frame expande da própria posição até tomar quase a tela inteira.
 *
 * Detalhe de performance que decide esta seção: seis vídeos de 8 a 21 MB não
 * podem ser carregados juntos. Todos entram com preload="none" e só baixam
 * quando o ponteiro chega — antes disso, o que se vê é o pôster gerado do
 * primeiro frame pelo próprio elemento.
 */
const CLIPS = CLIPES.map((src, i) => ({ src, n: String(i + 1).padStart(2, '0') }))

export default function ClipsSection() {
  const rootRef = useRef(null)
  const tapeRef = useRef(null)
  const videoRefs = useRef([])
  const [open, setOpen] = useState(null)

  useEffect(() => {
    const root = rootRef.current
    const tape = tapeRef.current
    if (!root || !tape) return

    const ctx = gsap.context(() => {
      const distance = () => Math.max(0, tape.scrollWidth - window.innerWidth * 0.9)
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
    }, root)

    return () => ctx.revert()
  }, [])

  // Ao fechar o clipe aberto, pausa: um vídeo continuar rodando fora da tela é
  // desperdício de decodificação e de bateria.
  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return
      if (open !== null && i !== open) v.pause()
    })
  }, [open])

  const hoverIn = (i) => {
    if (open !== null) return
    const v = videoRefs.current[i]
    if (!v) return
    v.play().catch(() => {})
  }

  const hoverOut = (i) => {
    if (open === i) return
    const v = videoRefs.current[i]
    if (!v) return
    v.pause()
    v.currentTime = 0
  }

  return (
    <section ref={rootRef} className="evom-clips" aria-label="Clipes">
      <div className="evom-clips__stage">
        <p className="evom-clips__eyebrow">Clipes</p>

        <div ref={tapeRef} className="evom-clips__tape">
          {CLIPS.map((c, i) => (
            <figure
              className={`evom-clips__frame${open === i ? ' is-open' : ''}`}
              key={c.src}
              onPointerEnter={() => hoverIn(i)}
              onPointerLeave={() => hoverOut(i)}
              onClick={() => setOpen(open === i ? null : i)}
            >
              <video
                ref={(el) => {
                  videoRefs.current[i] = el
                }}
                src={c.src}
                muted
                loop
                playsInline
                preload="none"
                disablePictureInPicture
              />
              <figcaption>
                <span className="evom-clips__n">{c.n}</span>
                <span className="evom-clips__cta">{open === i ? 'fechar' : 'assistir'}</span>
              </figcaption>
            </figure>
          ))}
        </div>

        <p className="evom-clips__hint">passe o mouse para pré-visualizar · clique para abrir</p>
      </div>
    </section>
  )
}
