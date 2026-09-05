import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { CAPAS, spotifyForAlbum } from '../assets.js'
import './CoverCompanion.css'

/**
 * A capa que te acompanha.
 *
 * A partir do capítulo em que o disco aparece, ele não some mais: a capa
 * encolhe para um vinil de rodapé e segue o resto da leitura. É o mesmo
 * truque de um filme que planta um objeto no primeiro ato — a presença
 * constante é o que faz o encerramento fechar em cima de algo já conhecido,
 * em vez de apresentar a capa de novo do zero.
 *
 * Ela entra quando a capa explode (capítulo V) e sai no encerramento, onde o
 * quadro volta a ser dele. Ficar até o fim seria um widget; sair na hora
 * certa é direção.
 */
export default function CoverCompanion() {
  const rootRef = useRef(null)

  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    // Sem gatilho no meio do caminho: a decisão é geométrica. Entre o topo do
    // capítulo do disco e o topo do encerramento, ela existe. Fora disso, não.
    const from = document.querySelector('.evom-shatter')
    const to = document.querySelector('.evom-finale')
    if (!from || !to) return

    let shown = null
    let pending = false

    const resolve = () => {
      pending = false
      const y = window.scrollY + window.innerHeight * 0.5
      const want = y > from.offsetTop + from.offsetHeight * 0.5 && y < to.offsetTop
      if (want === shown) return
      shown = want
      gsap.to(el, {
        autoAlpha: want ? 1 : 0,
        y: want ? 0 : 24,
        scale: want ? 1 : 0.86,
        duration: 0.6,
        ease: 'power3.out',
        overwrite: 'auto',
      })
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
    <a
      ref={rootRef}
      className="evom-companion"
      href={spotifyForAlbum()}
      target="_blank"
      rel="noopener noreferrer"
    >
      <span className="evom-companion__disc" aria-hidden="true">
        <img src={CAPAS.euVenciOMundo} alt="" />
        <span className="evom-companion__hole" />
      </span>
      <span className="evom-companion__text">
        <em>Eu Venci o Mundo</em>
        Veigh &middot; 2025
      </span>
    </a>
  )
}
