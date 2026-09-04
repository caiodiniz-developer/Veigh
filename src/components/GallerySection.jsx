import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ERA, SHOWS } from '../assets.js'
import './GallerySection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Memory wall — mural maior que a viewport.
 *
 * Não é grid: as fotos ficam espalhadas numa superfície larga, tortas em
 * ângulos diferentes, e o usuário arrasta para percorrer. O scroll também
 * empurra o mural de lado, então quem só rola continua vendo material novo.
 *
 * As 23 fotos do projeto são pequenas (a maior tem 1152px). O mural é o lugar
 * certo para elas justamente por isso: aqui nenhuma precisa passar de ~300px
 * de largura, bem abaixo do que os arquivos aguentam.
 */

const WALL = [
  ...ERA.dosPredios,
  ...SHOWS,
  ...ERA.dosPrediosDeluxe,
  ...ERA.euVenciOMundo,
]

// Espalhamento determinístico: posição, rotação e tamanho derivam do índice,
// então o mural é sempre o mesmo — não muda a cada recarga, o que faria a
// composição parecer acidental em vez de desenhada.
const place = (i) => {
  const col = Math.floor(i / 3)
  const row = i % 3
  return {
    left: col * 18 + (row % 2 ? 6 : 0),
    top: row * 27 + ((i * 37) % 11),
    rot: ((i * 53) % 9) - 4,
    scale: 0.82 + ((i * 29) % 32) / 100,
  }
}

export default function GallerySection() {
  const rootRef = useRef(null)
  const wallRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    const wall = wallRef.current
    if (!root || !wall) return

    const ctx = gsap.context(() => {
      const distance = () => Math.max(0, wall.scrollWidth - window.innerWidth)

      gsap.to(wall, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => '+=' + distance() * 1.1,
          scrub: 0.8,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })

      // Profundidade: fotos de escalas diferentes andam em velocidades
      // diferentes. O descompasso é o que dá camada ao mural.
      wall.querySelectorAll('.evom-wall__shot').forEach((shot, i) => {
        gsap.to(shot, {
          xPercent: (i % 3) * -6,
          ease: 'none',
          scrollTrigger: { trigger: root, start: 'top top', end: 'bottom top', scrub: 1.2 },
        })
      })
    }, root)

    return () => ctx.revert()
  }, [])

  // Arrasto: soma um deslocamento livre por cima do que o scroll já aplica.
  useEffect(() => {
    const wall = wallRef.current
    if (!wall) return
    let dragging = false
    let startX = 0
    let base = 0

    const down = (e) => {
      dragging = true
      startX = e.clientX
      base = Number(gsap.getProperty(wall, '--drag')) || 0
      wall.classList.add('is-dragging')
      wall.setPointerCapture?.(e.pointerId)
    }
    const move = (e) => {
      if (!dragging) return
      gsap.set(wall, { '--drag': base + (e.clientX - startX) })
    }
    const up = () => {
      dragging = false
      wall.classList.remove('is-dragging')
    }

    wall.addEventListener('pointerdown', down)
    wall.addEventListener('pointermove', move)
    wall.addEventListener('pointerup', up)
    wall.addEventListener('pointercancel', up)
    return () => {
      wall.removeEventListener('pointerdown', down)
      wall.removeEventListener('pointermove', move)
      wall.removeEventListener('pointerup', up)
      wall.removeEventListener('pointercancel', up)
    }
  }, [])

  return (
    <section ref={rootRef} className="evom-wall" aria-label="Galeria">
      <div className="evom-wall__stage">
        <p className="evom-wall__eyebrow">Memory wall</p>

        <div ref={wallRef} className="evom-wall__surface">
          {WALL.map((src, i) => {
            const p = place(i)
            return (
              <figure
                className="evom-wall__shot"
                key={src}
                style={{
                  left: `${p.left}vw`,
                  top: `${p.top}vh`,
                  '--rot': `${p.rot}deg`,
                  '--scale': p.scale,
                }}
              >
                <img src={src} alt="" aria-hidden="true" loading="lazy" decoding="async" draggable="false" />
              </figure>
            )
          })}
        </div>

        <p className="evom-wall__hint">arraste ou role</p>
      </div>
    </section>
  )
}
