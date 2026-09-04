import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ERA, SHOWS } from '../assets.js'
import { createPhotoPlanet } from './photoPlanet.js'
import './WorldSection.css'

gsap.registerPlugin(ScrollTrigger)

const PHOTOS = [...ERA.dosPredios, ...ERA.dosPrediosDeluxe, ...ERA.euVenciOMundo, ...SHOWS]
const STEPS = ['SÃO PAULO', 'BRASIL', 'MUNDO']

/**
 * Do Brasil pro mundo — o planeta de fotografias.
 *
 * A cena é WebGL e os rótulos são HTML por cima: misturar as duas camadas é o
 * que permite tipografia nítida em qualquer tela sobre uma esfera de mil e
 * seiscentas fotos. Tudo dirigido pelo mesmo progresso de scroll.
 */
export default function WorldSection({ height = '420vh' }) {
  const rootRef = useRef(null)
  const canvasRef = useRef(null)
  const stepsRef = useRef([])

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return

    let planet = null
    let cancelled = false
    let st = null

    createPhotoPlanet(canvas, PHOTOS).then((scene) => {
      if (cancelled || !scene) return
      planet = scene

      st = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => planet.setProgress(self.progress),
        // Aqui o loop faz sentido (a esfera gira sozinha), então ele liga e
        // desliga com a visibilidade da seção em vez de rodar a página toda.
        onToggle: (self) => (self.isActive ? planet.start() : planet.stop()),
      })

      planet.setProgress(st.progress)
      if (st.isActive) planet.start()
      ScrollTrigger.refresh()
    })

    const ctx = gsap.context(() => {
      // Os três rótulos se revezam: um por terço do percurso.
      stepsRef.current.filter(Boolean).forEach((el, i) => {
        const at = i / STEPS.length
        gsap
          .timeline({
            scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
          })
          .fromTo(el, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 0.12 }, at)
          .to(el, { autoAlpha: 0, y: -30, duration: 0.1 }, at + 0.22)
      })

      gsap.fromTo(
        root.querySelector('.evom-world__final'),
        { autoAlpha: 0, scale: 0.94 },
        {
          autoAlpha: 1,
          scale: 1,
          ease: 'power2.out',
          scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
          immediateRender: false,
          duration: 0.12,
          delay: 0,
          startAt: {},
        }
      )
    }, root)

    return () => {
      cancelled = true
      st?.kill()
      ctx.revert()
      planet?.dispose()
    }
  }, [])

  return (
    <section ref={rootRef} className="evom-world" style={{ height }} aria-label="Do Brasil pro mundo">
      <div className="evom-world__stage">
        <canvas ref={canvasRef} className="evom-world__canvas" aria-hidden="true" />

        <div className="evom-world__labels">
          {STEPS.map((s, i) => (
            <p
              className="evom-world__step"
              key={s}
              ref={(el) => {
                stepsRef.current[i] = el
              }}
            >
              {s}
            </p>
          ))}
        </div>

        <p className="evom-world__final">EU VENCI O MUNDO.</p>
      </div>
    </section>
  )
}
