import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CHAPTERS } from '../chapters.js'
import './CreditsRoll.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Créditos finais.
 *
 * Um site que passou treze capítulos se comportando como filme não termina em
 * rodapé: termina com a coluna subindo. A rolagem é scrubada pelo scroll, como
 * todo o resto — os créditos sobem porque VOCÊ continua descendo, o que é a
 * mesma gramática do site inteiro em vez de um vídeo tocando sozinho.
 *
 * O conteúdo é só o que dá para verificar aqui dentro: os capítulos que você
 * acabou de atravessar, quem construiu o site e com o quê. Não invento
 * produtor, gravadora nem engenheiro de mixagem do disco — esses nomes são
 * reais, existem, e chutar qualquer um deles seria pior do que não ter a
 * seção. Se você quiser a ficha técnica do álbum aqui, é só me passar que eu
 * encaixo no mesmo formato.
 */
const BLOCKS = [
  { role: 'Em treze capítulos', names: CHAPTERS.map((c) => `${c.num}. ${c.title}`) },
  { role: 'Desenvolvimento e direção de arte', names: ['Caio Diniz'] },
  { role: 'Construído com', names: ['React', 'GSAP + ScrollTrigger', 'Three.js', 'Vite'] },
]

export default function CreditsRoll({ height = '320vh' }) {
  const rootRef = useRef(null)
  const rollRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    const roll = rollRef.current
    if (!root || !roll) return

    const ctx = gsap.context(() => {
      // A coluna começa abaixo da borda de baixo e sobe até passar inteira
      // pela borda de cima. Medir a altura real em vez de chutar um yPercent
      // é o que mantém o percurso certo quando o texto quebra em outra
      // largura de tela.
      const travel = () => window.innerHeight + roll.offsetHeight

      gsap.fromTo(
        roll,
        { y: () => window.innerHeight },
        {
          y: () => window.innerHeight - travel(),
          ease: 'none',
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.5,
            invalidateOnRefresh: true,
          },
        }
      )
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section ref={rootRef} className="evom-credits" style={{ height }} aria-label="Créditos">
      <div className="evom-credits__stage">
        <div ref={rollRef} className="evom-credits__roll">
          <p className="evom-credits__mark">VEIGH</p>
          <p className="evom-credits__album">
            EU VENCI
            <br />O MUNDO
          </p>

          {BLOCKS.map((b) => (
            <div className="evom-credits__block" key={b.role}>
              <p className="evom-credits__role">{b.role}</p>
              <ul className="evom-credits__names">
                {b.names.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </div>
          ))}

          <p className="evom-credits__end">Dos prédios até aqui.</p>
        </div>

        {/* Vinheta por cima: os créditos aparecem e somem nas bordas em vez de
            cortarem em linha reta, que é como uma película se comporta. */}
        <div className="evom-credits__vignette" aria-hidden="true" />
      </div>
    </section>
  )
}
