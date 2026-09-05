import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SHOWS, VEIGH_CUTOUT } from '../assets.js'
import { createCrowd } from './crowdScene.js'
import './ShowsSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Dos prédios para os palcos — o palco, montado.
 *
 * A cena tem três planos, e a separação entre eles é o que faz a fotografia
 * funcionar:
 *
 *   FUNDO      painéis de show e a treliça de refletores
 *   MEIO       o palco e o artista em cima dele, nítidos e contraluz
 *   FRENTE     a plateia em WebGL, desfocada, cortada pela borda de baixo
 *
 * A câmera está no meio do público olhando para cima. Antes ela estava no
 * palco olhando a multidão — o que impedia justamente de ver alguém no palco.
 *
 * O palco não é WebGL: é DOM com perspectiva. Mantê-lo fora do canvas é o que
 * permite o recorte do artista ficar nítido e a plateia na frente ficar fora
 * de foco, que é a profundidade de campo de uma foto de show de verdade.
 */
export default function ShowsSection({ height = '380vh' }) {
  const rootRef = useRef(null)
  const canvasRef = useRef(null)
  const stageRef = useRef(null)
  const artistRef = useRef(null)
  const titleRef = useRef(null)
  const beamsRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    let crowd = null
    let cancelled = false
    let st = null

    createCrowd(canvasRef.current).then((scene) => {
      if (cancelled || !scene) return
      crowd = scene
      st = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => crowd.setProgress(self.progress),
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

      // A ordem é a de um show começando: primeiro os feixes varrendo o vazio,
      // depois o palco aparecendo, e só então o artista.
      tl.fromTo(
        beamsRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 0.14, ease: 'power2.out' },
        0.04
      )
      tl.fromTo(
        stageRef.current,
        { autoAlpha: 0, y: 60 },
        { autoAlpha: 1, y: 0, duration: 0.16, ease: 'power2.out' },
        0.14
      )
      tl.fromTo(
        artistRef.current,
        { autoAlpha: 0, y: 90, scale: 0.94 },
        { autoAlpha: 1, y: 0, scale: 1, duration: 0.2, ease: 'power2.out' },
        0.26
      )
      tl.fromTo(
        titleRef.current,
        { autoAlpha: 0, y: 40 },
        { autoAlpha: 1, y: 0, duration: 0.16, ease: 'power2.out' },
        0.5
      )
      tl.to(titleRef.current, { autoAlpha: 0, y: -30, duration: 0.14, ease: 'power2.in' }, 0.84)
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
        {/* -------------------------------------------------------- fundo */}
        <div className="evom-shows__back" aria-hidden="true">
          {/* Treliça de luz: a barra de cima com os refletores pendurados. */}
          <div className="evom-shows__truss">
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <span className="evom-shows__lamp" key={i} style={{ '--i': i }} />
            ))}
          </div>

          {/* Painéis de fundo com as fotos de show, como telão atrás dele. */}
          <div className="evom-shows__screens">
            {SHOWS.slice(0, 3).map((src, i) => (
              <span
                className="evom-shows__screen"
                key={src}
                style={{ backgroundImage: `url(${src})`, '--i': i }}
              />
            ))}
          </div>
        </div>

        {/* Feixes: trapézios com clip-path, não gradientes retangulares — é o
            corte que faz ler como cone saindo de uma fonte pontual. */}
        <div ref={beamsRef} className="evom-shows__beams" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => (
            <span className="evom-shows__beam" key={i} style={{ '--i': i }} />
          ))}
        </div>

        {/* --------------------------------------------------------- palco */}
        <div ref={stageRef} className="evom-shows__deck" aria-hidden="true">
          <span className="evom-shows__deck-top" />
          <span className="evom-shows__deck-face" />
          <span className="evom-shows__deck-glow" />
        </div>

        <div ref={artistRef} className="evom-shows__artist">
          {/* Halo de contraluz atrás dele: é o que descola a silhueta do fundo
              escuro e o que faz o recorte parar de parecer colado. */}
          <span className="evom-shows__rim" aria-hidden="true" />
          <img src={VEIGH_CUTOUT} alt="Veigh no palco" />
          {/* Sombra projetada no piso, achatada pela perspectiva. */}
          <span className="evom-shows__shadow" aria-hidden="true" />
        </div>

        {/* -------------------------------------------------------- frente */}
        <canvas ref={canvasRef} className="evom-shows__canvas" aria-hidden="true" />
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
