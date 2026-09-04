import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import './CinemaLayer.css'

/**
 * Cartelas de capítulo.
 *
 * Numeral romano e título no canto, dois segundos e some. Créditos de filme,
 * não navegação — a cartela nomeia o ato e sai, em vez de virar um rótulo
 * permanente competindo com o conteúdo.
 *
 * O capítulo corrente é resolvido por POSIÇÃO: quem ocupa o centro da tela.
 * A primeira versão usava um ScrollTrigger com onEnter por capítulo, e num
 * salto de scroll vários cruzam a fronteira no mesmo quadro — quem definia o
 * estado final era o último a disparar, que raramente é a seção onde o
 * usuário parou. Por posição funciona igual em salto, arrasto ou rolagem.
 */

// Numeral e título por capítulo, na ordem do documento.
const CHAPTERS = [
  { sel: '.evom-intro', num: 'I', title: 'Eu Venci o Mundo' },
  { sel: '.evom-manifesto', num: 'II', title: 'Antes dos prédios' },
  { sel: '.evom-history', num: 'III', title: 'A história' },
  { sel: '.evom-tl', num: 'IV', title: 'A trajetória' },
  { sel: '.evom-shatter', num: 'V', title: 'O disco' },
  { sel: '.evom-player', num: 'VI', title: 'Ouça o projeto' },
  { sel: '.evom-stats', num: 'VII', title: 'Os números' },
  { sel: '.evom-disc', num: 'VIII', title: 'Discografia' },
  { sel: '.evom-wall', num: 'IX', title: 'Mesa de luz' },
  { sel: '.evom-clips', num: 'X', title: 'A sala de projeção' },
  { sel: '.evom-shows', num: 'XI', title: 'Dos prédios para os palcos' },
  { sel: '.evom-world', num: 'XII', title: 'Do Brasil pro mundo' },
  { sel: '.evom-finale', num: 'XIII', title: 'Eu Venci o Mundo' },
]

export default function CinemaLayer() {
  const cardRef = useRef(null)
  const numRef = useRef(null)
  const titleRef = useRef(null)

  useEffect(() => {
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
        .to(cardRef.current, { autoAlpha: 0, duration: 0.6, ease: 'power2.in' }, '+=2')
    }

    const nodes = CHAPTERS.map((ch) => ({ ...ch, el: document.querySelector(ch.sel) })).filter(
      (c) => c.el
    )

    let current = null
    let pending = false

    const resolve = () => {
      pending = false
      const mid = window.innerHeight / 2
      const hit = nodes.find((c) => {
        const r = c.el.getBoundingClientRect()
        return r.top <= mid && r.bottom >= mid
      })
      if (!hit || current === hit.sel) return
      current = hit.sel
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

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <>
      <div ref={cardRef} className="evom-cine__card" aria-hidden="true">
        <span ref={numRef} className="evom-cine__num" />
        <span ref={titleRef} className="evom-cine__title" />
      </div>

    </>
  )
}
