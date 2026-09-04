import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SHOWS } from '../assets.js'
import { createCrowd } from './crowdScene.js'
import './ShowsSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Shows — a única seção em que você está do lado de dentro.
 *
 * Antes eram seis fotos numa fila com refletores acendendo por cima: o show
 * era o assunto, mas quem olhava continuava de fora. Agora a câmera está no
 * palco, olhando de volta para a plateia, e o que se vê são milhares de luzes
 * de celular subindo aos poucos.
 *
 * As fotografias não sumiram — elas viraram o telão ao fundo, atrás da
 * multidão, que é onde a imagem de um show fica num show.
 */
export default function ShowsSection({ height = '360vh' }) {
  const rootRef = useRef(null)
  const canvasRef = useRef(null)
  const titleRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let crowd = null
    let cancelled = false
    let st = null

    createCrowd(canvasRef.current, SHOWS).then((scene) => {
      if (cancelled || !scene) return
      crowd = scene

      st = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => crowd.setProgress(self.progress),
        // A multidão balança sozinha, então a cena precisa de loop — mas só
        // enquanto ela está na tela.
        onToggle: (self) => (self.isActive ? crowd.start() : crowd.stop()),
      })

      crowd.setProgress(st.progress)
      if (st.isActive) crowd.start()
      ScrollTrigger.refresh()
    })

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.6 },
      })
      tl.to({}, { duration: 1 }, 0) // espaçador: trava a duração em 1

      tl.fromTo(
        titleRef.current,
        { autoAlpha: 0, y: 44 },
        { autoAlpha: 1, y: 0, duration: 0.18, ease: 'power2.out' },
        0.2
      )
      tl.to(titleRef.current, { autoAlpha: 0, y: -34, duration: 0.16, ease: 'power2.in' }, 0.76)
    }, root)

    return () => {
      cancelled = true
      st?.kill()
      ctx.revert()
      crowd?.dispose()
    }
  }, [])

  return (
    <section ref={rootRef} className="evom-shows" style={{ height }} aria-label="Shows">
      <div className="evom-shows__stage">
        <canvas ref={canvasRef} className="evom-shows__canvas" aria-hidden="true" />

        {/* Fumaça de palco por cima da multidão: é o que separa as fileiras e
            impede que o campo de luzes vire um chuvisco uniforme. */}
        <span className="evom-shows__haze" aria-hidden="true" />

        <h2 ref={titleRef} className="evom-shows__title">
          DOS PRÉDIOS
          <br />
          <span>PARA OS PALCOS.</span>
        </h2>
      </div>
    </section>
  )
}
