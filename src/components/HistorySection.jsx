import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { VIDEOS } from '../assets.js'
import { readMotionMode, CALM } from '../motion.js'
import './HistorySection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Seção 1 — "A História".
 *
 * Vem logo depois da intro e usa a mesma geometria: uma seção alta com o palco
 * em `position: sticky` (nunca `pin: true` — ver IntroSequence.css: mesma
 * geometria, sem pin-spacing injetado no layout e sem o salto do unpin no
 * último frame), e uma timeline única scrubada pelo progresso do ScrollTrigger.
 *
 * A diferença técnica em relação à intro: aqui o vídeo NÃO é scrubado frame a
 * frame. Ele é atmosfera — toca sozinho em loop, mudo, e só é ligado quando a
 * seção entra em viewport. Nada de seek por scroll.
 *
 *   0 ─ 0.04 ──── 0.26 ─ 0.28 ──── 0.50 ─ 0.51 ──── 0.73 ─ 0.75 ──────── 1
 *   │ lead │ beat 1     │ beat 2         │ beat 3        │ beat 4        │
 *
 * Só um beat visível por vez: a saída de cada um termina ANTES da entrada do
 * seguinte (a folga entre eles é o "corte"). Tudo scrubado, então rolar pra
 * trás desfaz na ordem inversa.
 */

// Janelas de cada beat em progresso (0→1) da seção.
//   `in`  = início do fade de entrada
//   `out` = início do fade de saída (null = segura até o fim da seção)
// Invariante: BEATS[i].out + FADE <= BEATS[i + 1].in — é isso que garante que
// nunca há dois beats na tela ao mesmo tempo. Eles são absolutos e ocupam
// exatamente o mesmo retângulo; sobrepor viraria texto por cima de texto.
const FADE = 0.055
const BEATS = [
  { in: 0.04, out: 0.205 },
  { in: 0.28, out: 0.435 },
  { in: 0.51, out: 0.675 },
  { in: 0.75, out: null },
]

// Mesmo tratamento de entrada das letras da intro: fade + leve slide vertical.
const SLIDE_IN = 22 // yPercent de onde o beat nasce
const SLIDE_OUT = -14 // yPercent pra onde ele sai

// O MESMO conteúdo aprovado, reorganizado em campos. Nenhum fato novo entrou:
// tudo aqui já estava na prosa anterior. O que muda é a forma — ficha, não
// parágrafo. Não pus coordenadas nem números que eu não tivesse de origem.
const COPY = [
  {
    tag: 'Origem',
    fields: [
      ['Local', 'Itapevi, zona oeste · São Paulo'],
      ['Data', '12.09.2001'],
    ],
  },
  {
    tag: 'Antes',
    fields: [
      ['Emprego', 'Telemarketing, Alphaville'],
      ['Estúdio', 'Centro de São Paulo, à noite'],
    ],
  },
  {
    tag: '2022',
    fields: [
      ['Álbum', 'Dos Prédios'],
      ['Marca', 'O disco de trap nacional mais ouvido do Brasil'],
    ],
  },
  {
    tag: 'Hoje',
    fields: [
      ['Streams', '5 bilhões+'],
      ['Imprensa', 'Forbes Under 30'],
      ['Agora', 'Eu Venci o Mundo'],
    ],
  },
]

export default function HistorySection({
  // Atenção: o arquivo é minúsculo. Servidor Linux é case-sensitive e
  // "Video-sessao1.mp4" daria 404 em produção mesmo funcionando no Windows.
  videoSrc = VIDEOS.sessao1,
  poster = VIDEOS.sessao1Poster,
  beats = COPY,
  height = '440vh',
  respectReducedMotion = true,
}) {
  // Mesma escotilha da intro: ?motion=full força a versão completa em qualquer
  // máquina (no Windows, "Efeitos de animação" desligado já reporta `reduce`).
  // Política central: quem decide o modo é src/motion.js, não cada seção.
  // Enquanto cada componente checava prefers-reduced-motion por conta própria,
  // forçar o modo completo num lugar só não alcançava todos — manifesto,
  // história e timeline continuavam colapsando na máquina do dono do site.
  const [reduced] = useState(() => respectReducedMotion && readMotionMode() === CALM)

  const rootRef = useRef(null)
  const videoRef = useRef(null)
  const beatsRef = useRef([])

  const setBeatRef = useCallback(
    (index) => (el) => {
      beatsRef.current[index] = el
    },
    []
  )

  // ------------------------------------------------- play/pause por viewport
  // Um clipe de 13 MB não pode ficar decodificando durante a intro inteira.
  // IntersectionObserver em vez do onToggle do ScrollTrigger de propósito: o
  // ramo de reduced-motion não cria ScrollTrigger nenhum, e mesmo lá o vídeo
  // precisa rodar em loop. A margem de 300px dá o head start pro primeiro
  // frame chegar antes da seção entrar de fato (preload="metadata" + poster).
  useEffect(() => {
    const root = rootRef.current
    const video = videoRef.current
    if (!root || !video) return

    const play = () => {
      const p = video.play()
      // play() devolve Promise que rejeita silenciosamente (autoplay policy,
      // vídeo ainda sem dados). Engolir é intencional: o poster cobre.
      if (p && typeof p.then === 'function') p.catch(() => {})
    }

    if (typeof IntersectionObserver !== 'function') {
      play()
      return undefined
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) play()
        else if (!video.paused) video.pause()
      },
      { rootMargin: '300px 0px' }
    )
    io.observe(root)

    return () => {
      io.disconnect()
      video.pause()
    }
  }, [])

  // ---------------------------------------------------------- reduced motion
  useEffect(() => {
    if (!reduced) return
    // Os 4 beats em sequência vertical estática (o CSS tira o sticky e devolve
    // os parágrafos ao fluxo). Sem scrub, sem slide — só o estado final. O
    // vídeo de fundo continua em loop: ele não é movimento autônomo de
    // interface, é a atmosfera da seção.
    gsap.set(beatsRef.current.filter(Boolean), { autoAlpha: 1, yPercent: 0 })
  }, [reduced])

  // ------------------------------------------------------------------ scrub
  useEffect(() => {
    if (reduced) return

    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      const els = beatsRef.current.filter(Boolean)
      if (!els.length) return

      // Estado escondido explícito. Este trigger usa invalidateOnRefresh (por
      // trigger, nunca global) e o refresh chama invalidate(), que descarta os
      // valores gravados pelos fromTo posicionados adiante do playhead — sem
      // este set, os 4 beats apareceriam empilhados no primeiro paint.
      gsap.set(els, { autoAlpha: 0, yPercent: SLIDE_IN })

      const tl = gsap.timeline({
        // Timeline scrubada: o tempo é do usuário. Qualquer ease temporal aqui
        // descolaria o texto do dedo. A curva vem da geometria dos keyframes.
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.6, // mesmo amortecimento da intro
          invalidateOnRefresh: true,
        },
      })

      // Tween vazio de duração 1, ancorado em 0. Sem ele, a duração da timeline
      // seria o fim do último tween (0.805) e o scrub mapearia o progresso
      // 0→1 do scroll em 0→0.805 de tempo: todos os beats atrasariam ~24% e o
      // quarto nunca chegaria a ficar inteiro na tela. Com isto, as janelas de
      // BEATS são literalmente o progresso do scroll.
      tl.to({}, { duration: 1 }, 0)

      els.forEach((el, index) => {
        const beat = BEATS[index]
        if (!beat) return

        tl.fromTo(
          el,
          { autoAlpha: 0, yPercent: SLIDE_IN },
          { autoAlpha: 1, yPercent: 0, duration: FADE },
          beat.in
        )

        // O último beat não tem saída: segura na tela até o sticky soltar.
        if (beat.out === null) return

        tl.to(el, { autoAlpha: 0, yPercent: SLIDE_OUT, duration: FADE }, beat.out)
      })
    }, root)

    ScrollTrigger.refresh()

    // A degradação da imagem é dirigida por uma variável só, escrita direto no
    // elemento. Registrada com @property no CSS — sem o registro ela seria um
    // token sem tipo e ficaria presa no valor inicial dentro dos calc() de
    // filter e transform, que foi exatamente o que aconteceu na mesa de luz.
    const era = ScrollTrigger.create({
      trigger: rootRef.current,
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.6,
      onUpdate: (self) => {
        const root = rootRef.current
        if (!root) return
        root.style.setProperty('--era', self.progress.toFixed(4))
        // O tremor de fita só existe no começo, quando a imagem ainda é
        // memória. Classe em vez de amplitude por variável: keyframe com
        // amplitude variável exigiria registrar mais uma propriedade só para
        // isso, e o efeito é binário de qualquer forma.
        root.classList.toggle('is-degraded', self.progress < 0.34)
      },
    })

    return () => {
      era.kill()
      ctx.revert()
    }
  }, [reduced, beats])

  return (
    <section
      ref={rootRef}
      className={`evom-history${reduced ? ' is-static' : ''}`}
      style={reduced ? undefined : { height }}
      aria-labelledby="evom-history-title"
    >
      <div className="evom-history__stage">
        <div className="evom-history__media" aria-hidden="true">
          <video
            ref={videoRef}
            className="evom-history__video"
            src={videoSrc}
            poster={poster}
            muted
            loop
            playsInline
            // metadata (e não auto): o browser só busca os headers até o
            // IntersectionObserver dar o play. Com "auto" o clipe inteiro
            // desceria em paralelo com o scrub da intro, que é o trecho mais
            // caro da página.
            preload="metadata"
            disablePictureInPicture
            tabIndex={-1}
          />
        </div>

        <div className="evom-history__scrim" aria-hidden="true" />

        <div className="evom-history__content">
          <h2 id="evom-history-title" className="evom-history__sr-only">
            A História
          </h2>

          {/* Os beats animados ficam aria-hidden porque, a qualquer momento,
              três dos quatro estão em visibility:hidden. O leitor de tela
              recebe o texto inteiro, na ordem, deste bloco — mesma solução do
              verso da intro. */}
          {!reduced && (
            <div className="evom-history__sr-only">
              {beats.map((rec) => (
                <p key={rec.tag}>
                  {rec.tag}. {rec.fields.map(([k, v]) => `${k}: ${v}.`).join(' ')}
                </p>
              ))}
            </div>
          )}

          <div className="evom-history__beats" aria-hidden={!reduced}>
            {beats.map((rec, index) => (
              <div key={rec.tag} ref={setBeatRef(index)} className="evom-history__beat">
                <p className="evom-history__tag">
                  <span className="evom-history__n">
                    {String(index + 1).padStart(2, '0')}/{String(beats.length).padStart(2, '0')}
                  </span>
                  {rec.tag}
                </p>

                <dl className="evom-history__fields">
                  {rec.fields.map(([k, v]) => (
                    <div className="evom-history__row" key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
