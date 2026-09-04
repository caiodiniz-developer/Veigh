import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createIntroBackground } from './introBackground.js'
import { PENDANTS, VIDEOS } from '../assets.js'
import { readMotionMode, CALM } from '../motion.js'
import './IntroSequence.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Intro do EVOM — inteiramente dirigida pelo scroll (scrollytelling).
 * Nada aqui roda por timer ou autoplay: o motor é sempre o progresso (0→1) do
 * ScrollTrigger sobre uma seção alta com o palco em sticky.
 *
 *   0 ──────────── 0.55 ── 0.65 ─────────────── 1
 *   │ ATO 1          │ ATO 2 │ ATO 3             │
 *   │ vídeo scrubado │ corte │ E V O M + verso   │
 *
 * Tudo é scrubado, então rolar pra trás desfaz na ordem inversa.
 */

const ACT1_END = 0.55 // fim do scrub do vídeo
const ACT2_END = 0.65 // fim do corte cinematográfico
const ACT2_LEN = ACT2_END - ACT1_END
const SEG = (1 - ACT2_END) / 5 // E, V, O, M, texto

// Sub-trecho do verso: escrita caractere a caractere + entrega pra próxima seção.
//   0.930 ───────────── 0.973 ─ 0.975 ────── 1
//   │ escrita + cursor  │ hold  │ saída      │
const WRITE_START = ACT2_END + 4 * SEG // 0.93
const OUTRO_START = 0.975 // a intro começa a entregar o palco
const OUTRO_MID = 0.99
const WRITE_LEN = (OUTRO_START - WRITE_START) * 0.95 // sobra um respiro antes da saída
const CARET_BLINKS = 5

// Ease de "máquina de escrever": o caractere segura o valor inicial durante
// todo o seu slot de scroll e estala no último instante. O steps(1) do GSAP
// não serve aqui porque o SteppedEase troca em 50% do slot, o que abriria um
// buraco entre o caractere escrito e o cursor.
const holdThenSnap = (p) => (p < 1 ? 0 : 1)

// Piscada do cursor: onda quadrada, mas assimétrica (70% aceso / 30% apagado).
// steps(1) do GSAP daria 50/50 — e como a piscada é dirigida pelo scroll, ela
// congela onde o usuário parar: com 50/50, metade das paradas deixaria o
// cursor apagado, o que lê como bug em vez de intenção.
const caretBlink = (p) => (p < 0.7 ? 0 : 1)

// Só acorda a cena Three.js perto do corte: durante o scrub do vídeo ela ficaria
// disputando frame com a decodificação, que é o trecho mais caro da intro.
const BG_WAKE = 0.52 // progresso em que a cena Three.js começa a renderizar
const DEFAULT_LETTERS = PENDANTS

export default function IntroSequence({
  onIntroComplete,
  onProgress,
  // Versão all-intra (keyframe em todo frame) do clipe. É ela que torna o
  // scrub fluido: cada currentTime vira acesso direto, sem decodificar a
  // cadeia de frames desde o keyframe anterior. Ver public/README-video.md.
  videoSrc = VIDEOS.heroScrub,
  scrubFps = 30, // fps do arquivo acima — usado pra quantizar o seek
  letters = DEFAULT_LETTERS,
  manifesto = 'Eu Venci o Mundo.',
  height = '400vh',
  respectReducedMotion = true,
}) {
  // Atenção: no Windows, "Efeitos de animação" desligado (Configurações >
  // Acessibilidade > Efeitos visuais) já faz o browser reportar `reduce` — e
  // aí a intro inteira vira o estado final estático, sem scrub. É o
  // comportamento correto, mas passe respectReducedMotion={false} pra forçar
  // a versão completa quando estiver revisando a animação.
  const [reduced] = useState(() => respectReducedMotion && readMotionMode() === CALM)

  const rootRef = useRef(null)
  const canvasRef = useRef(null)
  const videoWrapRef = useRef(null)
  const videoRef = useRef(null)
  const flashRef = useRef(null)
  const noiseRef = useRef(null)
  const contentRef = useRef(null)
  const lettersRef = useRef([])
  const manifestoRef = useRef(null)
  const manifestoVisualRef = useRef(null)
  const charsRef = useRef([])
  const rgbRedRef = useRef(null)
  const rgbBlueRef = useRef(null)

  const completedRef = useRef(false)

  // Split manual por caractere. SplitText é plugin pago — e aqui nem faria
  // falta: o verso é fixo e cabe numa linha só. Array.from em vez de split('')
  // pra não partir pares substitutos.
  const chars = useMemo(() => Array.from(manifesto), [manifesto])

  useEffect(() => {
    charsRef.current.length = chars.length
  }, [chars])

  const complete = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    onIntroComplete?.()
  }, [onIntroComplete])

  // Pré-carrega os pingentes assim que o componente monta — não depende mais de
  // um Ato 1 com duração garantida, já que quem manda no tempo agora é o usuário.
  useEffect(() => {
    const preloaded = letters.map((src) => {
      const img = new Image()
      img.src = src
      return img
    })
    return () => preloaded.forEach((img) => (img.src = ''))
  }, [letters])

  // ----------------------------------------------------------- reduced motion
  useEffect(() => {
    if (!reduced) return
    // Modo calmo: o vídeo TOCA (em loop, sem scrub) e as letras e o verso
    // ficam legíveis por cima dele. Nada de scrub, glitch, punch zoom ou cena
    // Three.js — que é o que causa desconforto — mas a intro continua sendo
    // uma intro, com imagem em movimento e a marca na tela.
    const video = videoRef.current
    if (video) {
      const played = video.play()
      if (played && typeof played.catch === 'function') played.catch(() => {})
    }
    gsap.set(
      [
        ...lettersRef.current,
        ...charsRef.current,
        manifestoRef.current,
        contentRef.current,
      ].filter(Boolean),
      { autoAlpha: 1, scale: 1, y: 0, yPercent: 0 }
    )
    complete()
  }, [reduced, complete])

  // ------------------------------------------------------------------- scrub
  useEffect(() => {
    if (reduced) return

    const root = rootRef.current
    const video = videoRef.current
    if (!root || !video) return

    let cancelled = false
    let background = null
    let ctx = null

    const build = () => {
      if (cancelled || ctx) return

      background = createIntroBackground(canvasRef.current)

      ctx = gsap.context(() => {
        const duration =
          Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 5

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: root,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.6,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const p = self.progress
              onProgress?.(p)
              background?.setProgress(p)
              if (p > BG_WAKE) background?.start()
              else if (p < BG_WAKE - 0.05) background?.stop()
              if (p >= 0.999) complete()
            },
          },
        })

        // ATO 1 — scrubbing puro: o scroll é o cabeçote do vídeo, não playback.
        //
        // Não escrevo currentTime direto do tween: quantizo pro frame mais
        // próximo e só escrevo quando o frame muda. O ScrollTrigger atualiza a
        // ~60Hz e o clipe tem 30fps, então metade das escritas pediria um frame
        // que o browser já está mostrando — seek redundante, decode à toa.
        // Nada de listener de scroll paralelo: quem sincroniza é só esta timeline.
        const lastFrameIndex = Math.max(Math.floor(duration * scrubFps) - 1, 0)
        const head = { t: 0 }
        let lastFrame = -1
        tl.to(
          head,
          {
            t: duration,
            duration: ACT1_END,
            onUpdate: () => {
              const frame = Math.min(Math.round(head.t * scrubFps), lastFrameIndex)
              const wanted = frame / scrubFps
              // O segundo teste não é redundante: enquanto o vídeo fica
              // escondido (Ato 3), o Chrome pode descartar a mídia e zerar o
              // currentTime. Se ao voltar o scroll caísse exatamente no mesmo
              // frame do cache, o guard sozinho pularia a escrita e a intro
              // mostraria o frame 0. Conferir o estado real do elemento fecha isso.
              if (frame === lastFrame && Math.abs(video.currentTime - wanted) < 0.5 / scrubFps) return
              lastFrame = frame
              video.currentTime = wanted
            },
          },
          0
        )

        // ATO 2 — o corte. Punch zoom + aberração cromática + flash + ruído,
        // tudo dentro de 10% do scroll: entra, dá a porrada e sai.
        tl.set(videoWrapRef.current, { filter: 'url(#evom-rgb-split)' }, ACT1_END)
        tl.to(
          videoWrapRef.current,
          { scale: 1.38, duration: ACT2_LEN, ease: 'power3.in' },
          ACT1_END
        )
        tl.to(rgbRedRef.current, { attr: { dx: 22, dy: -5 }, duration: ACT2_LEN * 0.7 }, ACT1_END)
        tl.to(rgbBlueRef.current, { attr: { dx: -22, dy: 5 }, duration: ACT2_LEN * 0.7 }, ACT1_END)

        tl.fromTo(
          flashRef.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: ACT2_LEN * 0.55, ease: 'power2.in' },
          ACT1_END
        )
        tl.to(
          flashRef.current,
          { autoAlpha: 0, duration: ACT2_LEN * 0.45, ease: 'power2.out' },
          ACT1_END + ACT2_LEN * 0.55
        )

        tl.fromTo(
          noiseRef.current,
          { autoAlpha: 0 },
          { autoAlpha: 0.28, duration: ACT2_LEN * 0.5 },
          ACT1_END
        )
        tl.to(
          noiseRef.current,
          { autoAlpha: 0, duration: ACT2_LEN * 0.5 },
          ACT1_END + ACT2_LEN * 0.5
        )

        // A cena Three.js sobe por baixo do flash: o vinho nunca chega chapado.
        tl.fromTo(
          canvasRef.current,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: ACT2_LEN * 0.6 },
          ACT1_END + ACT2_LEN * 0.4
        )

        // Fim do corte: o vídeo sai de cena e leva o filtro junto.
        tl.set(videoWrapRef.current, { autoAlpha: 0, filter: 'none' }, ACT2_END)

        // ATO 3 — uma letra por sub-trecho, cada uma dentro do seu próprio slot
        // (o layout já está montado, então crescer não empurra as vizinhas).
        lettersRef.current.filter(Boolean).forEach((letter, index) => {
          tl.fromTo(
            letter,
            { scale: 0.38, autoAlpha: 0 },
            { scale: 1, autoAlpha: 1, duration: SEG, ease: 'back.out(1.6)' },
            ACT2_END + index * SEG
          )
        })

        // ------------------------------------------ o verso, escrito no scroll
        const charEls = charsRef.current.filter(Boolean)

        if (charEls.length) {
          // Estado escondido explícito. Depender do immediateRender de um fromTo
          // posicionado adiante do playhead é frágil — e este trigger usa
          // invalidateOnRefresh —, então o esconderijo é declarado na mão.
          gsap.set(charEls, { autoAlpha: 0, yPercent: 22 })

          // Um slot de scroll por caractere. `each` é a unidade de tudo aqui:
          // o caractere nasce no começo do slot e o cursor vive dentro dele.
          const each = WRITE_LEN / charEls.length

          tl.fromTo(
            charEls,
            { autoAlpha: 0, yPercent: 22 },
            {
              autoAlpha: 1,
              yPercent: 0,
              duration: each * 0.6,
              ease: 'none', // scrub: a curva vem da geometria, não do tempo
              stagger: each,
            },
            WRITE_START
          )

          // Cursor: cada caractere carrega o seu (::after), mas só o do
          // "cabeçote" fica aceso. Como o caractere anterior apaga o dele
          // exatamente quando o próximo acende, existe sempre um único cursor —
          // e ele acompanha a escrita sem nenhuma medição de layout, o que o
          // torna imune a resize e a rebreak de linha.
          tl.fromTo(
            charEls,
            { '--evom-caret-head': 1 },
            {
              '--evom-caret-head': 0,
              duration: each,
              ease: holdThenSnap,
              stagger: each,
              immediateRender: false,
            },
            WRITE_START
          )

          // Piscada dirigida pelo scroll: repeat sobre uma onda quadrada.
          // Nada de @keyframes com timer — quem pisca o cursor é a rolagem.
          tl.fromTo(
            manifestoVisualRef.current,
            { '--evom-caret-blink': 1 },
            {
              '--evom-caret-blink': 0,
              duration: WRITE_LEN / CARET_BLINKS,
              ease: caretBlink,
              repeat: CARET_BLINKS - 1,
              immediateRender: false,
            },
            WRITE_START
          )
        }

        // ----------------------------------------- entrega pra próxima seção
        // Fica na mesma timeline de propósito: dois scrubs independentes, cada
        // um com o seu smoothing, dessincronizariam a saída do palco sticky. O
        // alvo é o container do conteúdo, que nenhum outro tween toca — sem
        // disputa de propriedade. O palco em si não é tocado: o sticky segue
        // intacto e não pisca.
        tl.fromTo(
          contentRef.current,
          { y: 0, scale: 1, opacity: 1 },
          {
            y: -16,
            scale: 0.99,
            opacity: 0.82,
            duration: OUTRO_MID - OUTRO_START,
            ease: 'none',
          },
          OUTRO_START
        )
        tl.to(
          contentRef.current,
          {
            y: -78,
            scale: 0.955,
            opacity: 0.12, // nunca 0: a intro não pode sumir antes de 1.0
            duration: 1 - OUTRO_MID,
            ease: 'none',
          },
          OUTRO_MID
        )
      }, root)

      ScrollTrigger.refresh()
    }

    // currentTime só pode ser escrito depois que os metadados carregam.
    const onMeta = () => build()
    if (video.readyState >= 1) {
      build()
    } else {
      video.addEventListener('loadedmetadata', onMeta, { once: true })
      video.addEventListener('error', onMeta, { once: true })
    }

    // iOS só libera o decode (e portanto o seek) depois de um play; play+pause
    // imediato destrava o scrub sem nunca reproduzir de fato.
    const primed = video.play()
    if (primed && typeof primed.then === 'function') {
      primed.then(() => video.pause()).catch(() => {})
    }

    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('error', onMeta)
      ctx?.revert()
      background?.dispose()
    }
  }, [reduced, complete, onProgress, chars, scrubFps])


  return (
    <section
      ref={rootRef}
      className={`evom-intro${reduced ? ' is-static' : ''}`}
      style={{ height: reduced ? '100vh' : height }}
    >
      <div className="evom-intro__stage">
        <canvas ref={canvasRef} className="evom-intro__bg" aria-hidden="true" />

        {/* O vídeo existe nos dois modos. No modo completo ele é scrubado pelo
            scroll; no calmo ele simplesmente toca em loop atrás das letras.
            Sumir com ele deixava a intro sem imagem nenhuma. */}
        <div ref={videoWrapRef} className="evom-intro__video-wrap" aria-hidden="true">
          <video
            ref={videoRef}
            className="evom-intro__video"
            src={videoSrc}
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            {...(reduced ? { autoPlay: true, loop: true } : {})}
          />
        </div>

        <div ref={noiseRef} className="evom-intro__noise" aria-hidden="true" />
        <div ref={flashRef} className="evom-intro__flash" aria-hidden="true" />

        <div ref={contentRef} className="evom-intro__content">
          <div className="evom-intro__letters" aria-hidden="true">
            {/* --letter leva o PNG da própria letra para o CSS: é o que
                permite o brilho se mascarar na forma da joia. */}
            {letters.map((src, index) => (
              <span className="evom-intro__slot" key={src} style={{ '--letter': `url(${src})` }}>
                <img
                  ref={(el) => {
                    lettersRef.current[index] = el
                  }}
                  className="evom-intro__letter"
                  src={src}
                  alt=""
                  draggable="false"
                />
              </span>
            ))}
          </div>

          {/* O verso continua sendo um parágrafo com o texto real: o leitor de
              tela lê a frase inteira de uma vez, sem tropeçar nos spans de
              caractere, que ficam aria-hidden. */}
          <p ref={manifestoRef} className="evom-intro__manifesto">
            <span className="evom-sr-only">{manifesto}</span>
            <span
              ref={manifestoVisualRef}
              className="evom-intro__manifesto-visual"
              aria-hidden="true"
            >
              {chars.map((char, index) => {
                // O espaço vai cru mesmo — quem o preserva é o `white-space:
                // pre` do .evom-intro__char. Trocar por NBSP seria o reflexo
                // óbvio, mas na Shrikhand o U+00A0 tem avanço de 32,64px
                // contra 10,89px do U+0020 (medido a 54,4px): três vezes mais
                // largo. Com 3 espaços, o verso inchava 13,5% e os vãos entre
                // as palavras abriam visivelmente.
                const glyph = char
                return (
                  <span
                    key={`${char}-${index}`}
                    ref={(el) => {
                      charsRef.current[index] = el
                    }}
                    className="evom-intro__char"
                    data-char={glyph}
                  >
                    {glyph}
                  </span>
                )
              })}
            </span>
          </p>
        </div>
      </div>

      {/* Split RGB do Ato 2. Só é aplicado ao vídeo durante o corte — manter o
          filtro ligado no Ato 1 inteiro custaria repaint a cada frame. */}
      <svg className="evom-intro__defs" aria-hidden="true" focusable="false">
        <filter
          id="evom-rgb-split"
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
          colorInterpolationFilters="sRGB"
        >
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="channelR"
          />
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="channelG"
          />
          <feColorMatrix
            in="SourceGraphic"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="channelB"
          />
          <feOffset ref={rgbRedRef} in="channelR" dx="0" dy="0" result="shiftR" />
          <feOffset ref={rgbBlueRef} in="channelB" dx="0" dy="0" result="shiftB" />
          <feBlend in="shiftR" in2="channelG" mode="screen" result="rg" />
          <feBlend in="rg" in2="shiftB" mode="screen" />
        </filter>
      </svg>
    </section>
  )
}
