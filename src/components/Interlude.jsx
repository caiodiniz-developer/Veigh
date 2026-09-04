import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './Interlude.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Pausa entre capítulos.
 *
 * Tela preta, uma frase, silêncio, e só então o próximo capítulo. É o que
 * separa um filme de uma sequência de seções: sem respiro, o olho lê tudo
 * como um bloco contínuo e para de registrar que mudou de ambiente.
 *
 * A altura importa mais que a animação. Uma pausa curta não é pausa — é
 * transição. Por padrão são 220vh, o que dá vários segundos de rolagem com
 * quase nada acontecendo, e é exatamente esse "quase nada" que faz o próximo
 * capítulo chegar com peso.
 *
 * A frase entra, segura e sai dentro do próprio percurso. Ela nunca divide a
 * tela com o capítulo anterior nem com o seguinte: o preto sólido cobre as
 * duas emendas.
 */
export default function Interlude({ text, sub = null, height = '220vh' }) {
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
      // Espaçador travando a duração em 1: sem ele a duração vem do conteúdo
      // e as posições abaixo deixam de corresponder ao progresso do scroll.
      tl.to({}, { duration: 1 }, 0)

      // Entra no primeiro terço, segura o miolo inteiro, sai no fim. O hold
      // longo é o ponto da seção — é o silêncio.
      tl.fromTo(
        root.querySelector('.evom-interlude__line'),
        { autoAlpha: 0, y: 26 },
        { autoAlpha: 1, y: 0, duration: 0.2, ease: 'power2.out' },
        0.12
      )
      tl.to(
        root.querySelector('.evom-interlude__line'),
        { autoAlpha: 0, y: -26, duration: 0.18, ease: 'power2.in' },
        0.72
      )

      if (sub) {
        tl.fromTo(
          root.querySelector('.evom-interlude__sub'),
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.14 },
          0.42
        )
        tl.to(root.querySelector('.evom-interlude__sub'), { autoAlpha: 0, duration: 0.14 }, 0.72)
      }

      // O fio de luz atravessa devagar durante todo o percurso: é o único
      // movimento contínuo, e é o que impede a pausa de parecer travamento.
      tl.fromTo(
        root.querySelector('.evom-interlude__thread'),
        { scaleX: 0, autoAlpha: 0 },
        { scaleX: 1, autoAlpha: 1, duration: 0.55, ease: 'power1.inOut' },
        0.1
      )
      tl.to(root.querySelector('.evom-interlude__thread'), { autoAlpha: 0, duration: 0.16 }, 0.74)
    }, root)

    return () => ctx.revert()
  }, [sub])

  return (
    <section ref={rootRef} className="evom-interlude" style={{ height }} aria-label={text}>
      <div className="evom-interlude__stage">
        <span className="evom-interlude__thread" aria-hidden="true" />
        <p className="evom-interlude__line">{text}</p>
        {sub && <p className="evom-interlude__sub">{sub}</p>}
      </div>
    </section>
  )
}
