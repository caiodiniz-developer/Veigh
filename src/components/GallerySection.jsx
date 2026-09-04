import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ERA, SHOWS } from '../assets.js'
import './GallerySection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Mesa de luz — a galeria como mesa de edição fotográfica.
 *
 * As fotos estão sobre vidro iluminado por baixo, espalhadas e tortas como
 * slides largados na mesa. Por padrão ficam FORA DE FOCO: são material bruto,
 * descarte. O cursor é a lupa — o que passa por baixo dela ganha nitidez,
 * saturação e um pouco de escala.
 *
 * A lupa não duplica o mural. Duplicar exigiria 23 imagens a mais só para a
 * camada nítida sob uma máscara; em vez disso cada foto recebe um valor de
 * foco (0 a 1) calculado pela distância até o cursor, escrito direto em custom
 * property. São 23 escritas de estilo por frame, agrupadas num rAF só.
 */

const WALL = [
  ...ERA.dosPredios,
  ...SHOWS,
  ...ERA.dosPrediosDeluxe,
  ...ERA.euVenciOMundo,
]

const LOUPE = 300 // raio de influência da lupa, em px

// Espalhamento determinístico: a mesa é sempre a mesma. Aleatório a cada carga
// faria a composição parecer acidente em vez de arranjo.
const place = (i) => {
  const col = Math.floor(i / 3)
  const row = i % 3
  return {
    left: col * 18 + (row % 2 ? 6 : 0),
    top: row * 27 + ((i * 37) % 11),
    rot: ((i * 53) % 13) - 6,
    scale: 0.84 + ((i * 29) % 30) / 100,
  }
}

export default function GallerySection() {
  const rootRef = useRef(null)
  const wallRef = useRef(null)
  const loupeRef = useRef(null)
  const shotsRef = useRef([])

  // ------------------------------------------------------------ scroll lateral
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
    }, root)

    return () => ctx.revert()
  }, [])

  // ------------------------------------------------------------------- a lupa
  useEffect(() => {
    const root = rootRef.current
    const loupe = loupeRef.current
    if (!root) return
    // Sem lupa em ponteiro grosso: no toque não existe hover, e uma lupa que
    // só reage ao arrasto atrapalharia a navegação.
    if (!window.matchMedia('(pointer: fine)').matches) return

    let raf = 0
    let x = -9999
    let y = -9999
    let pending = false

    const apply = () => {
      pending = false
      if (loupe) loupe.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`

      for (const shot of shotsRef.current) {
        if (!shot) continue
        const r = shot.getBoundingClientRect()
        const dx = x - (r.left + r.width / 2)
        const dy = y - (r.top + r.height / 2)
        const d = Math.hypot(dx, dy)
        // 1 no centro da lupa, 0 fora do alcance. A curva quadrática mantém a
        // borda do foco suave — linear cria um anel duro visível.
        const focus = Math.max(0, 1 - d / LOUPE) ** 2
        const before = Number(shot.dataset.focus || 0)
        shot.style.setProperty('--focus', focus.toFixed(3))
        shot.dataset.focus = focus
        // Avisa a trilha ao ENTRAR no foco, não a cada frame dentro dele.
        // Evento em vez de import direto: a galeria não precisa saber que
        // existe uma trilha, e a trilha não precisa conhecer a galeria.
        if (before < 0.55 && focus >= 0.55) {
          window.dispatchEvent(new CustomEvent('evom:slide'))
        }
      }
    }

    const move = (e) => {
      x = e.clientX
      y = e.clientY
      // Uma passada por frame. Sem isso seriam 23 leituras de layout por
      // evento de mouse, e o mural engasgaria ao arrastar.
      if (!pending) {
        pending = true
        raf = requestAnimationFrame(apply)
      }
    }

    const leave = () => {
      x = -9999
      y = -9999
      apply()
    }

    root.addEventListener('pointermove', move)
    root.addEventListener('pointerleave', leave)
    return () => {
      root.removeEventListener('pointermove', move)
      root.removeEventListener('pointerleave', leave)
      cancelAnimationFrame(raf)
    }
  }, [])

  // ----------------------------------------------------------------- arrastar
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
        {/* O vidro da mesa, iluminado por baixo. */}
        <div className="evom-wall__glass" aria-hidden="true">
          <span className="evom-wall__backlight" />
          <span className="evom-wall__frost" />
        </div>

        <p className="evom-wall__eyebrow">Mesa de luz</p>

        <div ref={wallRef} className="evom-wall__surface">
          {WALL.map((src, i) => {
            const p = place(i)
            return (
              <figure
                className="evom-wall__shot"
                key={src}
                ref={(el) => {
                  shotsRef.current[i] = el
                }}
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

        {/* O anel da lupa. Só decoração: quem faz o foco é o valor --focus
            escrito em cada slide. */}
        <span ref={loupeRef} className="evom-wall__loupe" aria-hidden="true" />

        <p className="evom-wall__hint">a lupa segue o cursor · arraste para percorrer</p>
      </div>
    </section>
  )
}
