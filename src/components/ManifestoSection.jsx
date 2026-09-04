import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ERA } from '../assets.js'
import { readMotionMode, CALM } from '../motion.js'
import './ManifestoSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Manifesto tipográfico — o capítulo entre a intro e a história.
 *
 * Quatro frases, uma por vez, dirigidas pelo scroll. A última é preenchida pela
 * própria fotografia (background-clip: text) e depois "abre": um clip-path parte
 * da caixa do texto e se expande até a viewport inteira, de modo que a foto que
 * estava dentro das letras vira o plano de fundo do próximo capítulo.
 *
 *   0 ──── 0.20 ──── 0.38 ──── 0.56 ──── 0.72 ──────────── 1
 *   │ NÚMEROS │ PALCOS │ MUNDO  │ PRÉDIOS │ abertura       │
 *
 * A escolha de revelar a foto por dentro da tipografia não é só estética: as
 * fotos disponíveis são pequenas (a maior tem 1152px de largura), e vista por
 * dentro de letras a imagem nunca precisa cobrir a viewport em tamanho real —
 * o recorte esconde a limitação em vez de ampliá-la.
 */

const PHRASES = ['ANTES DOS NÚMEROS.', 'ANTES DOS PALCOS.', 'ANTES DO MUNDO.']
const FINAL = 'EXISTIAM OS PRÉDIOS.'

const STEP = 0.18 // fatia de scroll de cada frase
const FINAL_IN = STEP * 3 // 0.54 — a frase mascarada entra
const OPEN_START = 0.72 // as letras começam a abrir
const HOLD = 0.94 // foto aberta, respiro antes de entregar a próxima seção

const PHOTO_ASPECT = 1152 / 2048 // proporção real dos retratos do lote

/**
 * Até onde a abertura vai. Numa viewport landscape a foto NÃO vai a plano
 * cheio: ela para numa janela vertical com a proporção do próprio arquivo.
 *
 * O motivo é a resolução. A 1440x900, um plano cheio exigiria ampliar a foto
 * de 1152px para 2560px de largura (2,2x) e ainda cortaria tudo menos uma tira
 * do meio. Parando na janela, a mesma foto ocupa ~506px de largura vindo de
 * 1152 — reduzindo, portanto nítida — e ainda ganha a leitura de fotografia
 * exposta no escuro, que é o que a seção quer dizer. Em viewport vertical
 * (celular) a proporção já bate e aí sim vai a plano cheio.
 *
 * Função em vez de valor fixo: com invalidateOnRefresh o GSAP reavalia no
 * resize, então a janela acompanha a tela.
 */
const sideInset = () => {
  if (typeof window === 'undefined') return 0
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (vw / vh <= PHOTO_ASPECT * 1.2) return 0
  return Math.max(0, ((vw - vh * PHOTO_ASPECT) / 2 / vw) * 100)
}

// A abertura é uma íris vertical: a fenda inicial já tem a largura final da
// janela, então as letras "abrem" de cima pra baixo em vez de crescer nos
// quatro lados. Mantém o eixo da leitura e evita a barra horizontal atravessando
// a tela que a versão anterior produzia.
const closedInset = () => `inset(44% ${sideInset().toFixed(2)}% 44% ${sideInset().toFixed(2)}%)`
const openInset = () => `inset(0% ${sideInset().toFixed(2)}% 0% ${sideInset().toFixed(2)}%)`

export default function ManifestoSection({
  photo = ERA.dosPredios[2], // a de maior resolução do lote (1152x2048)
  height = '500vh',
  respectReducedMotion = true,
}) {
  // Política central: quem decide o modo é src/motion.js, não cada seção.
  // Enquanto cada componente checava prefers-reduced-motion por conta própria,
  // forçar o modo completo num lugar só não alcançava todos — manifesto,
  // história e timeline continuavam colapsando na máquina do dono do site.
  const [reduced] = useState(() => respectReducedMotion && readMotionMode() === CALM)

  const rootRef = useRef(null)
  const phraseRefs = useRef([])
  const finalRef = useRef(null)
  const revealRef = useRef(null)
  const vignetteRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    if (reduced) {
      // Sem scrub: as frases ficam empilhadas e legíveis, e a foto aparece
      // inteira. A narrativa continua de pé, só não é dirigida pelo scroll.
      gsap.set([...phraseRefs.current, finalRef.current].filter(Boolean), {
        autoAlpha: 1,
        y: 0,
      })
      gsap.set(revealRef.current, { autoAlpha: 1, clipPath: 'inset(0% 0% 0% 0%)' })
      return
    }

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      })

      // As três primeiras: entram, seguram, saem. Cada uma sai empurrada pra
      // cima enquanto a próxima sobe — nunca duas na tela ao mesmo tempo.
      phraseRefs.current.filter(Boolean).forEach((el, i) => {
        const at = i * STEP
        tl.fromTo(
          el,
          { autoAlpha: 0, yPercent: 40 },
          { autoAlpha: 1, yPercent: 0, duration: STEP * 0.45, ease: 'power2.out' },
          at
        )
        tl.to(
          el,
          { autoAlpha: 0, yPercent: -40, duration: STEP * 0.35, ease: 'power2.in' },
          at + STEP * 0.65
        )
      })

      // A quarta entra igual, mas fica: é ela que vira a janela.
      tl.fromTo(
        finalRef.current,
        { autoAlpha: 0, yPercent: 40 },
        { autoAlpha: 1, yPercent: 0, duration: STEP * 0.45, ease: 'power2.out' },
        FINAL_IN
      )

      // A abertura. O clip-path parte de uma faixa fina na altura do texto e
      // cresce até a viewport inteira: a foto que estava presa dentro das
      // letras passa a ocupar a tela. clip-path e opacity só — nada de reflow.
      // immediateRender: false é obrigatório aqui. Sem ele o GSAP renderiza o
      // estado "from" no momento em que a timeline é montada, e a faixa da
      // fotografia aparece atrás das frases desde o progresso 0 — cortando
      // inclusive o acento de PRÉDIOS. A foto só existe a partir da abertura.
      tl.set(revealRef.current, { autoAlpha: 1 }, OPEN_START)
      tl.fromTo(
        revealRef.current,
        { clipPath: closedInset },
        {
          clipPath: openInset,
          duration: HOLD - OPEN_START,
          ease: 'power2.inOut',
          immediateRender: false,
        },
        OPEN_START
      )

      // O texto mascarado se dissolve enquanto a foto assume — se ele ficasse,
      // as letras apareceriam recortadas por cima da própria imagem.
      tl.to(
        finalRef.current,
        { autoAlpha: 0, duration: (HOLD - OPEN_START) * 0.5, ease: 'power2.in' },
        OPEN_START + (HOLD - OPEN_START) * 0.15
      )

      // A vinheta fecha um pouco no fim: escurece as bordas e prepara a
      // passagem pro próximo capítulo sem um corte seco.
      tl.fromTo(
        vignetteRef.current,
        { autoAlpha: 0 },
        { autoAlpha: 1, duration: 1 - HOLD },
        HOLD
      )
    }, root)

    return () => ctx.revert()
  }, [reduced, photo])

  return (
    <section
      ref={rootRef}
      className={`evom-manifesto${reduced ? ' is-static' : ''}`}
      style={{ height: reduced ? 'auto' : height }}
      aria-label="Antes dos prédios"
    >
      <div className="evom-manifesto__stage">
        {/* A fotografia em plano cheio, revelada pela abertura das letras. */}
        <div
          ref={revealRef}
          className="evom-manifesto__reveal"
          style={{ backgroundImage: `url(${photo})` }}
          aria-hidden="true"
        />
        <div ref={vignetteRef} className="evom-manifesto__vignette" aria-hidden="true" />

        <div className="evom-manifesto__type">
          {PHRASES.map((phrase, i) => (
            <p
              key={phrase}
              ref={(el) => {
                phraseRefs.current[i] = el
              }}
              className="evom-manifesto__phrase"
            >
              {phrase}
            </p>
          ))}

          {/* A frase-janela: o fill é a própria fotografia. */}
          <p
            ref={finalRef}
            className="evom-manifesto__phrase evom-manifesto__phrase--masked"
            style={{ backgroundImage: `url(${photo})` }}
          >
            {FINAL}
          </p>
        </div>
      </div>
    </section>
  )
}
