import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { sfx } from '../soundtrack.js'
import './CinemaLayer.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * A camada de cinema: letterbox, cartelas de capítulo e a regência do som.
 *
 * Vive por cima de tudo e é a única coisa no site que conhece a sequência
 * inteira. Cada capítulo declara aqui o seu ar de sala, a sua cartela e se é
 * um momento de tela cheia ou de quadro fechado.
 *
 * O letterbox fecha em 2.39:1 nos trechos narrativos e ABRE nos clímaxes.
 * Contra-intuitivo de propósito: barras constantes viram moldura decorativa
 * e o olho para de vê-las em trinta segundos. É a abertura que dá o impacto,
 * então o quadro fechado é o repouso e a tela cheia é o acontecimento.
 */

// numeral, título e ambiente por capítulo. A ordem é a do documento.
const CHAPTERS = [
  { sel: '.evom-intro', num: 'I', title: 'Eu Venci o Mundo', room: 'intro', open: true },
  { sel: '.evom-manifesto', num: 'II', title: 'Antes dos prédios', room: 'manifesto' },
  { sel: '.evom-history', num: 'III', title: 'A história', room: 'history' },
  { sel: '.evom-tl', num: 'IV', title: 'A trajetória', room: 'road' },
  { sel: '.evom-shatter', num: 'V', title: 'O disco', room: 'shatter', open: true },
  { sel: '.evom-player', num: 'VI', title: 'Ouça o projeto', room: 'player' },
  { sel: '.evom-stats', num: 'VII', title: 'Os números', room: 'sky', open: true },
  { sel: '.evom-disc', num: 'VIII', title: 'Discografia', room: 'player' },
  { sel: '.evom-wall', num: 'IX', title: 'Mesa de luz', room: 'sky' },
  { sel: '.evom-clips', num: 'X', title: 'A sala de projeção', room: 'stage' },
  { sel: '.evom-shows', num: 'XI', title: 'Dos prédios para os palcos', room: 'stage' },
  { sel: '.evom-world', num: 'XII', title: 'Do Brasil pro mundo', room: 'world', open: true },
  { sel: '.evom-finale', num: 'XIII', title: 'Eu Venci o Mundo', room: 'finale', open: true },
]

export default function CinemaLayer() {
  const barTopRef = useRef(null)
  const barBottomRef = useRef(null)
  const cardRef = useRef(null)
  const numRef = useRef(null)
  const titleRef = useRef(null)

  const [soundOn, setSoundOn] = useState(false)

  // ------------------------------------------------------------ som + quadro
  useEffect(() => {
    const setFrame = (open) => {
      // 2.39:1 num quadro 16:9 come cerca de 10,5% em cima e embaixo.
      gsap.to([barTopRef.current, barBottomRef.current], {
        height: open ? '0vh' : '10.5vh',
        duration: 1.1,
        ease: 'power3.inOut',
        overwrite: 'auto',
      })
    }

    const showCard = (num, title) => {
      if (!cardRef.current) return
      numRef.current.textContent = num
      titleRef.current.textContent = title
      gsap
        .timeline({ overwrite: 'auto' })
        .fromTo(
          cardRef.current,
          { autoAlpha: 0, x: -14 },
          { autoAlpha: 1, x: 0, duration: 0.55, ease: 'power2.out' }
        )
        // Dois segundos e some: cartela de filme não é rótulo permanente.
        .to(cardRef.current, { autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, '+=2')
    }

    // O capítulo corrente é o que ocupa o CENTRO da tela — não o último a
    // disparar um onEnter.
    //
    // A primeira versão usava um ScrollTrigger por capítulo com onEnter. Num
    // salto de scroll vários cruzam a fronteira no mesmo quadro e quem define
    // o estado final é o último a disparar, que raramente é a seção em que o
    // usuário parou: medido, o letterbox ficava fechado até nos capítulos
    // marcados como tela cheia. Resolver por posição é determinístico e
    // funciona igual em salto, arrasto ou rolagem contínua.
    const nodes = CHAPTERS.map((ch) => ({ ...ch, el: document.querySelector(ch.sel) })).filter(
      (c) => c.el
    )
    const pauses = [...document.querySelectorAll('.evom-interlude')]

    let current = null
    let pending = false

    const resolve = () => {
      pending = false
      const mid = window.innerHeight / 2

      // A pausa vence o capítulo: ela existe justamente para interromper.
      const inPause = pauses.some((el) => {
        const r = el.getBoundingClientRect()
        return r.top <= mid && r.bottom >= mid
      })

      if (inPause) {
        if (current !== 'pause') {
          current = 'pause'
          sfx.setChapter('pause')
          setFrame(false)
        }
        return
      }

      const hit = nodes.find((c) => {
        const r = c.el.getBoundingClientRect()
        return r.top <= mid && r.bottom >= mid
      })
      if (!hit || current === hit.sel) return

      current = hit.sel
      sfx.setChapter(hit.room)
      setFrame(!!hit.open)
      showCard(hit.num, hit.title)
    }

    const onScroll = () => {
      if (pending) return
      pending = true
      requestAnimationFrame(resolve)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    resolve()

    // Impacto e riser continuam em ScrollTrigger: são eventos pontuais dentro
    // de uma seção, não estado de capítulo.
    const ctx = gsap.context(() => {
      const shatter = document.querySelector('.evom-shatter')
      if (shatter) {
        let fired = false
        ScrollTrigger.create({
          trigger: shatter,
          start: 'top top',
          end: 'bottom bottom',
          onUpdate: (self) => {
            // No ponto exato em que os cacos explodem, não na entrada da seção.
            if (!fired && self.progress > 0.17 && self.direction === 1) {
              fired = true
              sfx.impact(1)
            }
            if (self.progress < 0.12) fired = false
          },
        })
      }

      const road = document.querySelector('.evom-tl')
      if (road) {
        let rising = null
        ScrollTrigger.create({
          trigger: road,
          start: 'top 30%',
          end: 'bottom 60%',
          onEnter: () => {
            rising = sfx.riser(3.2)
          },
          onLeave: () => {
            try {
              rising?.stop()
            } catch {
              // já parou sozinho
            }
            sfx.impact(0.5)
          },
        })
      }
    })

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      ctx.revert()
    }
  }, [])

  // A lupa da mesa de luz clica. Ouve o evento em vez de acoplar os
  // componentes: a galeria não precisa saber que existe trilha.
  useEffect(() => {
    const onClick = () => sfx.click()
    window.addEventListener('evom:slide', onClick)
    return () => window.removeEventListener('evom:slide', onClick)
  }, [])

  const toggleSound = () => {
    if (!soundOn) {
      // O contexto só pode nascer aqui: dentro do gesto.
      const ok = sfx.unlock()
      if (!ok) return
      sfx.setMuted(false)
      setSoundOn(true)
    } else {
      sfx.setMuted(true)
      setSoundOn(false)
    }
  }

  return (
    <>
      <div ref={barTopRef} className="evom-cine__bar evom-cine__bar--top" aria-hidden="true" />
      <div ref={barBottomRef} className="evom-cine__bar evom-cine__bar--bottom" aria-hidden="true" />

      <div ref={cardRef} className="evom-cine__card" aria-hidden="true">
        <span ref={numRef} className="evom-cine__num" />
        <span ref={titleRef} className="evom-cine__title" />
      </div>

      <button
        type="button"
        className={`evom-cine__sound${soundOn ? ' is-on' : ''}`}
        onClick={toggleSound}
        aria-pressed={soundOn}
        aria-label={soundOn ? 'Desligar som' : 'Ligar som'}
      >
        <span className="evom-cine__bars" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </span>
        {soundOn ? 'som' : 'ligar som'}
      </button>
    </>
  )
}
