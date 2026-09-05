import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { CHAPTERS } from '../chapters.js'
import './CinemaLayer.css'

/**
 * Cartelas de capítulo e a barra lateral.
 *
 * A cartela é crédito de filme: numeral romano e título no canto, dois
 * segundos e some. Nomeia o ato e sai, em vez de virar rótulo permanente
 * competindo com o conteúdo.
 *
 * A barra é a outra metade do problema. A cartela responde "que capítulo é
 * este"; ela some justamente para não poluir, e aí some junto a resposta de
 * "quanto falta" — que num site de treze capítulos e ~40 telas de altura é
 * uma pergunta legítima. A barra fica, mas em treze traços de um pixel: dá a
 * posição sem pedir atenção, e cresce só quando o mouse chega perto.
 *
 * As duas leem o mesmo estado, resolvido por POSIÇÃO: quem ocupa o centro da
 * tela. A primeira versão usava um ScrollTrigger com onEnter por capítulo, e
 * num salto de scroll vários cruzam a fronteira no mesmo quadro — quem
 * definia o estado final era o último a disparar, que raramente é a seção
 * onde o usuário parou. Por posição funciona igual em salto, arrasto ou
 * rolagem.
 */
export default function CinemaLayer() {
  const cardRef = useRef(null)
  const numRef = useRef(null)
  const titleRef = useRef(null)
  const railRef = useRef(null)

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
    const ticks = railRef.current
      ? [...railRef.current.querySelectorAll('.evom-cine__tick')]
      : []

    let current = null
    let pending = false

    const resolve = () => {
      pending = false

      // Progresso da página inteira, para o fio que preenche a barra.
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (railRef.current) {
        railRef.current.style.setProperty('--p', max > 0 ? (window.scrollY / max).toFixed(4) : '0')
      }

      const mid = window.innerHeight / 2
      const hitIndex = nodes.findIndex((c) => {
        const r = c.el.getBoundingClientRect()
        return r.top <= mid && r.bottom >= mid
      })
      const hit = nodes[hitIndex]
      if (!hit || current === hit.sel) return
      current = hit.sel

      // O traço aceso é o do capítulo no centro da tela. A lista de ticks
      // segue CHAPTERS, e nodes pode ser menor (uma seção ausente do DOM),
      // então o índice tem que voltar pelo seletor e não pela posição.
      ticks.forEach((t) => {
        t.dataset.on = String(t.dataset.sel === hit.sel)
      })

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

  const jump = (sel) => {
    const el = document.querySelector(sel)
    if (el) window.scrollTo({ top: el.offsetTop, behavior: 'smooth' })
  }

  return (
    <>
      <div ref={cardRef} className="evom-cine__card" aria-hidden="true">
        <span ref={numRef} className="evom-cine__num" />
        <span ref={titleRef} className="evom-cine__title" />
      </div>

      <nav ref={railRef} className="evom-cine__rail" aria-label="Capítulos">
        {CHAPTERS.map((ch) => (
          <button
            type="button"
            key={ch.sel}
            className="evom-cine__tick"
            data-sel={ch.sel}
            data-on="false"
            onClick={() => jump(ch.sel)}
          >
            {/* O rótulo existe no DOM para leitor de tela e só ganha opacidade
                no hover — a barra em repouso é apenas o traço. */}
            <span className="evom-cine__tick-label">
              <em>{ch.num}</em>
              {ch.title}
            </span>
          </button>
        ))}
      </nav>
    </>
  )
}
