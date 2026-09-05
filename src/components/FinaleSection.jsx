import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { GIF_HERO, FRASE_FINAL } from '../assets.js'
import './FinaleSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Encerramento — o loop em plano cheio e a assinatura no meio dele.
 *
 * A versão anterior tinha quatro frases passando ("DOS PRÉDIOS." / "PARA O
 * BRASIL." / …), a assinatura tipográfica e um CTA. Saiu tudo. O site inteiro
 * já é a explicação; um fim que explica de novo é um fim que não confia no que
 * veio antes. Sobra a imagem e a marca — e nada depois, o que é o que faz o
 * silêncio ser o encerramento em vez de uma pausa.
 *
 * O loop é o MESMO da abertura do manifesto. Fechar com o material que abriu
 * transforma a página num laço em vez de uma lista de capítulos: o primeiro e
 * o último quadro são o mesmo, e o que mudou no meio foi você.
 *
 * A assinatura entra com o scroll, não com um timer. É o último gesto que a
 * página pede, e pedi-lo mantém a mesma gramática das outras treze seções.
 */
export default function FinaleSection({ height = '260vh' }) {
  const rootRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
          invalidateOnRefresh: true,
        },
      })
      tl.to({}, { duration: 1 }, 0) // espaçador: trava a duração total em 1

      // O escurecimento do loop e a entrada da marca são o mesmo movimento: a
      // imagem recua para a marca poder existir sobre ela.
      tl.fromTo(
        root.querySelector('.evom-finale__scrim'),
        { autoAlpha: 0.15 },
        { autoAlpha: 0.72, duration: 0.6 },
        0
      )

      tl.fromTo(
        root.querySelector('.evom-finale__mark'),
        { autoAlpha: 0, scale: 0.82, y: 30 },
        { autoAlpha: 1, scale: 1, y: 0, duration: 0.34, ease: 'power2.out' },
        0.22
      )

      // Respiro no fim: a marca ganha um leve avanço enquanto a seção termina,
      // então a última coisa que a página faz é chegar mais perto.
      tl.to(root.querySelector('.evom-finale__mark'), { scale: 1.06, duration: 0.4 }, 0.6)
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={rootRef} className="evom-finale" style={{ height }} aria-label="Eu Venci o Mundo">
      <div className="evom-finale__stage">
        {/* WebP animado, então <img> e não canvas nem background de WebGL:
            como textura ele congelaria no primeiro quadro. */}
        <img className="evom-finale__loop" src={GIF_HERO} alt="" aria-hidden="true" />
        <div className="evom-finale__scrim" aria-hidden="true" />

        <img className="evom-finale__mark" src={FRASE_FINAL} alt="Eu Venci o Mundo" />
      </div>
    </section>
  )
}
