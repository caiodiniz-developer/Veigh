import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CAPAS } from '../assets.js'
import { createCoverShatter } from './coverShatter.js'
import './ShatterSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * WOW 01 — a capa desmonta e vira a frase.
 *
 * Cena Three.js de verdade, não efeito 2D: a capa é uma malha instanciada de
 * 3364 cacos que explodem e reconvergem desenhando "EU VENCI / O MUNDO". O
 * scroll não dispara a animação, ele É a animação — cada pixel de rolagem
 * corresponde a um estado da cena, e voltar desfaz.
 *
 * A frase forma e FICA. No fim do percurso o palco escurece até o preto com
 * ela ainda montada, e é o preto que sai rolando — não a frase.
 *
 * Isto resolve um problema que não era o que parecia: a queixa era de que a
 * frase "voltava para a foto". Ela nunca voltava. O que acontecia é que o
 * palco sticky rolava para cima com a frase intacta e o player entrava logo
 * embaixo exibindo a capa do álbum. A leitura era idêntica a uma reversão.
 */
export default function ShatterSection({ cover = CAPAS.euVenciOMundo, height = '460vh' }) {
  const rootRef = useRef(null)
  const canvasRef = useRef(null)
  const fadeRef = useRef(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return

    let scene = null
    let cancelled = false

    // Espera a fonte: os alvos dos cacos são amostrados do desenho do texto num
    // canvas 2D. Se a Space Grotesk ainda não carregou, o navegador desenha a
    // fonte de fallback e a frase sai com outra silhueta.
    const boot = () => {
      if (cancelled) return
      scene = createCoverShatter(canvas, cover)
      if (!scene) {
        setFailed(true)
        return
      }

      const st = ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.55,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          scene.setProgress(self.progress)
          // Escurece nos últimos 12%: a frase permanece montada por trás e
          // quem sai de cena é o preto.
          const fade = Math.min(Math.max((self.progress - 0.88) / 0.12, 0), 1)
          if (fadeRef.current) fadeRef.current.style.opacity = fade.toFixed(3)
        },
        // Sem onToggle desligando render: a cena desenha sob demanda dentro do
        // setProgress, então já não gasta GPU parada — e o estado final não
        // corre o risco de ficar congelado no meio do caminho.
        onRefresh: (self) => scene.setProgress(self.progress),
      })

      // Entrar já com o estado certo, caso a página abra no meio da seção.
      scene.setProgress(st.progress)
      ScrollTrigger.refresh()
    }

    if (document.fonts?.ready) document.fonts.ready.then(boot)
    else boot()

    return () => {
      cancelled = true
      scene?.dispose()
    }
  }, [cover])

  return (
    <section ref={rootRef} className="evom-shatter" style={{ height }} aria-label="Eu Venci o Mundo">
      <div className="evom-shatter__stage">
        <canvas ref={canvasRef} className="evom-shatter__canvas" aria-hidden="true" />

        {/* Sem WebGL a seção não pode ficar vazia: cai na capa e na frase. */}
        {failed && (
          <div className="evom-shatter__fallback">
            <img src={cover} alt="Capa de Eu Venci o Mundo" />
            <p>EU VENCI O MUNDO</p>
          </div>
        )}

        <div ref={fadeRef} className="evom-shatter__fade" aria-hidden="true" />

        <p className="evom-shatter__sr">Eu Venci o Mundo</p>
      </div>
    </section>
  )
}
