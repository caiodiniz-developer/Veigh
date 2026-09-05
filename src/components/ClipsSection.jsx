import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CLIPES } from '../assets.js'
import './ClipsSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Clipes — a sala de projeção.
 *
 * A versão anterior era uma fita horizontal de seis cards de vidro. Estava bem
 * acabada e estava errada de premissa: seis vídeos lado a lado significam seis
 * vídeos pequenos, e "sala de projeção" com seis telas ao mesmo tempo é uma
 * loja de televisores. Uma sala de projeção tem UMA tela.
 *
 * Então agora tem uma. O clipe corrente ocupa o telão no meio do palco; os
 * outros cinco esperam embaixo como quadros de película numa bancada de
 * montagem. O scroll troca a bobina — é ele que passa de um clipe para o
 * outro, e a troca acontece com um corte branco, que é o que uma emenda de
 * película faz ao passar pelo projetor.
 *
 * O que faz a tela parecer projetada, e não um <video> numa caixa:
 *
 *   FEIXE     o cone de luz sai de trás de quem olha e abre até a tela, com
 *             poeira dentro dele — projeção é a luz atravessando o ar
 *   TREMOR    o quadro oscila alguns décimos de pixel (gate weave): película
 *             nunca fica perfeitamente registrada no projetor
 *   CINTILA   a luminosidade varia de leve, no ritmo do obturador
 *   GRÃO      ruído por cima de tudo, que é o que une o vídeo digital ao resto
 *
 * Clicar na tela abre o clipe com som, em tela cheia. O player é o mesmo de
 * antes: ele estava certo, era só o caminho até ele que estava errado.
 *
 * Sobre os metadados: os seis arquivos chegaram como "video curto 1..6", sem
 * título, data ou contagem de views. Duração eu leio do próprio arquivo — esse
 * dado é real. Título, ano, tipo e views ficam como campos opcionais: a
 * interface só desenha o que existe, então nada aparece inventado.
 */
const CLIPS = CLIPES.map((src, i) => ({
  src,
  n: String(i + 1).padStart(2, '0'),
  // title: 'Vida Chique',
  // kind: 'Clipe oficial',
  // year: '2022',
  // views: '48M',
  title: null,
  kind: null,
  year: null,
  views: null,
}))

const fmt = (s) => {
  if (!Number.isFinite(s)) return '--:--'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function ClipsSection({ height = '520vh' }) {
  const rootRef = useRef(null)
  const screenRef = useRef(null)
  const reelRef = useRef(null)
  const flashRef = useRef(null)
  const stripRefs = useRef([])
  const stageVideoRef = useRef(null)

  const modalRef = useRef(null)
  const frameRef = useRef(null)
  const videoRef = useRef(null)
  const openerRef = useRef(null) // para devolver o foco ao fechar

  const [reel, setReel] = useState(0) // o clipe no telão
  const [open, setOpen] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(NaN)
  const [muted, setMuted] = useState(false)
  const [durations, setDurations] = useState({})

  /* --------------------------------------------------- o scroll troca a bobina */
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: root,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.5,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          // O último clipe fica na tela até o fim da seção em vez de dividir a
          // faixa em seis partes iguais: sem isso ele apareceria por um
          // instante e a seção já teria acabado.
          const i = Math.min(CLIPS.length - 1, Math.floor(self.progress * CLIPS.length))
          setReel((atual) => (atual === i ? atual : i))
        },
      })
    }, root)

    return () => ctx.revert()
  }, [])

  // A emenda: um estouro branco curto no momento exato da troca. É o artefato
  // de uma colagem passando pelo projetor, e é ele que faz a troca ler como
  // corte de montagem em vez de um src trocando de valor.
  const primeiraBobina = useRef(true)
  useEffect(() => {
    if (primeiraBobina.current) {
      primeiraBobina.current = false
      return
    }
    const flash = flashRef.current
    if (!flash) return
    gsap
      .timeline()
      .fromTo(flash, { autoAlpha: 0 }, { autoAlpha: 0.9, duration: 0.07, ease: 'power2.out' })
      .to(flash, { autoAlpha: 0, duration: 0.36, ease: 'power2.in' })

    // O telão pisca de escala junto: o quadro "assenta" depois da emenda.
    if (screenRef.current) {
      gsap.fromTo(
        screenRef.current,
        { scale: 1.028 },
        { scale: 1, duration: 0.5, ease: 'power3.out' }
      )
    }
  }, [reel])

  // O vídeo do telão roda mudo e em loop. Trocar o src pausa o elemento em
  // parte dos navegadores, então o play é reemitido a cada bobina.
  useEffect(() => {
    const v = stageVideoRef.current
    if (!v) return
    v.load()
    v.play().catch(() => {})
  }, [reel])

  // Duração real de cada clipe, lida do arquivo. preload="metadata" baixa só o
  // cabeçalho — alguns segundos de rede, não os 8 a 21 MB de cada vídeo.
  useEffect(() => {
    const els = stripRefs.current.filter(Boolean)
    const onMeta = (e) => {
      const i = els.indexOf(e.target)
      if (i >= 0) setDurations((d) => ({ ...d, [i]: e.target.duration }))
    }
    els.forEach((el) => el.addEventListener('loadedmetadata', onMeta))
    return () => els.forEach((el) => el.removeEventListener('loadedmetadata', onMeta))
  }, [])

  /* ---------------------------------------------------------------- abertura */
  const openClip = useCallback((i, el) => {
    openerRef.current = el
    setOpen(i)
  }, [])

  const closeClip = useCallback(() => {
    const modal = modalRef.current
    const frame = frameRef.current
    const card = openerRef.current
    if (!modal || !frame) return setOpen(null)

    // Volta encolhendo para o elemento de origem — o inverso exato da abertura.
    const rect = card?.getBoundingClientRect()
    const tl = gsap.timeline({
      onComplete: () => {
        setOpen(null)
        card?.focus?.()
      },
    })
    if (rect) {
      const fr = frame.getBoundingClientRect()
      tl.to(
        frame,
        {
          x: rect.left + rect.width / 2 - (fr.left + fr.width / 2),
          y: rect.top + rect.height / 2 - (fr.top + fr.height / 2),
          scaleX: rect.width / fr.width,
          scaleY: rect.height / fr.height,
          duration: 0.42,
          ease: 'power3.in',
        },
        0
      )
    }
    tl.to(modal, { autoAlpha: 0, duration: 0.34, ease: 'power2.in' }, 0)
  }, [])

  // FLIP manual: o vídeo nasce exatamente sobre o elemento clicado e cresce até
  // a tela. Sem plugin — Flip é pago; medir os dois retângulos e interpolar dá
  // o mesmo resultado e mantém a origem do movimento onde a mão tocou.
  useEffect(() => {
    if (open === null) return
    const modal = modalRef.current
    const frame = frameRef.current
    const card = openerRef.current
    if (!modal || !frame) return

    const fr = frame.getBoundingClientRect()
    const rect = card?.getBoundingClientRect()

    gsap.set(modal, { autoAlpha: 0 })
    const tl = gsap.timeline()
    tl.to(modal, { autoAlpha: 1, duration: 0.36, ease: 'power2.out' }, 0)
    if (rect) {
      tl.fromTo(
        frame,
        {
          x: rect.left + rect.width / 2 - (fr.left + fr.width / 2),
          y: rect.top + rect.height / 2 - (fr.top + fr.height / 2),
          scaleX: rect.width / fr.width,
          scaleY: rect.height / fr.height,
        },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.62, ease: 'power3.out' },
        0
      )
    }

    // Trava o scroll do documento enquanto o cinema está aberto.
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (e) => {
      if (e.key === 'Escape') closeClip()
      if (e.key === ' ' || e.key === 'k') {
        e.preventDefault()
        setPlaying((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, closeClip])

  // Reprodução de verdade no modal.
  useEffect(() => {
    const v = videoRef.current
    if (open === null || !v) return

    const onTime = () => setTime(v.currentTime)
    const onMeta = () => setDuration(v.duration)
    const onEnd = () => setPlaying(false)
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('loadedmetadata', onMeta)
    v.addEventListener('ended', onEnd)

    // Tenta com som. Se o navegador recusar — política de autoplay, que vale
    // mesmo logo após um clique em parte dos casos — cai para mudo e continua
    // tocando, em vez de abrir um cinema com o vídeo parado. O controle de som
    // fica visível para o usuário reativar em um toque.
    v.muted = false
    v.play()
      .then(() => {
        setPlaying(true)
        setMuted(false)
      })
      .catch(() => {
        v.muted = true
        setMuted(true)
        v.play()
          .then(() => setPlaying(true))
          .catch(() => setPlaying(false))
      })

    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('loadedmetadata', onMeta)
      v.removeEventListener('ended', onEnd)
      v.pause()
    }
  }, [open])

  useEffect(() => {
    const v = videoRef.current
    if (!v || open === null) return
    if (playing) v.play().catch(() => setPlaying(false))
    else v.pause()
  }, [playing, open])

  const progress = Number.isFinite(duration) && duration > 0 ? time / duration : 0
  const current = open !== null ? CLIPS[open] : null
  const naTela = CLIPS[reel]

  return (
    <section ref={rootRef} className="evom-clips" style={{ height }} aria-label="Clipes">
      <div className="evom-clips__stage">
        {/* O palco, em camadas de trás para a frente: parede, feixes, chão. */}
        <div className="evom-clips__house" aria-hidden="true">
          <span className="evom-clips__backwall" />
          {[0, 1, 2, 3].map((i) => (
            <span className="evom-clips__spot" key={i} style={{ '--i': i }} />
          ))}
          <span className="evom-clips__floor" />
          <span className="evom-clips__horizon" />
          {[0, 1, 2].map((i) => (
            <span className="evom-clips__fog" key={i} style={{ '--i': i }} />
          ))}
        </div>

        <header className="evom-clips__head">
          <p className="evom-clips__eyebrow">Clipes</p>
          <h2 className="evom-clips__title">A SALA DE PROJEÇÃO.</h2>
        </header>

        {/* ------------------------------------------------------------ telão */}
        <div className="evom-clips__theatre">
          {/* O feixe: um trapézio de luz que sai de trás de quem olha e abre
              até a tela. É o corte, e não um gradiente, que faz ler como cone
              vindo de uma fonte pontual. */}
          <span className="evom-clips__beam" aria-hidden="true" />

          <button
            type="button"
            ref={screenRef}
            className="evom-clips__screen"
            onClick={(e) => openClip(reel, e.currentTarget)}
            aria-label={`Abrir clipe ${naTela.title || naTela.n} com som`}
          >
            <video
              ref={stageVideoRef}
              className="evom-clips__screen-video"
              src={naTela.src}
              muted
              loop
              autoPlay
              playsInline
              preload="auto"
              disablePictureInPicture
              aria-hidden="true"
            />

            {/* Tremor, cintilação e grão: as três assinaturas de projeção
                física, empilhadas por cima do vídeo digital. */}
            <span className="evom-clips__weave" aria-hidden="true" />
            <span className="evom-clips__grain" aria-hidden="true" />
            <span ref={flashRef} className="evom-clips__flash" aria-hidden="true" />

            <span className="evom-clips__badge" aria-hidden="true">
              <span className="evom-clips__n">{naTela.n}</span>
              {naTela.title && <span className="evom-clips__name">{naTela.title}</span>}
              {naTela.kind && <span className="evom-clips__tag">{naTela.kind}</span>}
              {naTela.year && <span className="evom-clips__tag">{naTela.year}</span>}
              <span className="evom-clips__dur">{fmt(durations[reel])}</span>
            </span>

            <span className="evom-clips__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="20" height="20">
                <path d="M8 5v14l11-7z" fill="currentColor" />
              </svg>
            </span>
          </button>

          {/* A poça de luz no chão do palco, sob a tela. */}
          <span className="evom-clips__pool" aria-hidden="true" />
        </div>

        {/* ------------------------------------------------ a bancada de montagem */}
        {/* Os seis quadros de película. O que está no projetor fica aceso; os
            outros esperam apagados, como fotogramas numa mesa de corte. */}
        <div ref={reelRef} className="evom-clips__reel" role="tablist" aria-label="Bobinas">
          {CLIPS.map((c, i) => (
            <button
              type="button"
              key={c.src}
              className={`evom-clips__frame-btn${i === reel ? ' is-on' : ''}`}
              role="tab"
              aria-selected={i === reel}
              onClick={() => setReel(i)}
              onDoubleClick={(e) => openClip(i, e.currentTarget)}
              aria-label={`Bobina ${c.n}`}
            >
              <video
                ref={(el) => {
                  stripRefs.current[i] = el
                }}
                src={c.src}
                muted
                playsInline
                preload="metadata"
                disablePictureInPicture
                aria-hidden="true"
              />
              <span className="evom-clips__frame-n">{c.n}</span>
            </button>
          ))}
        </div>

        <p className="evom-clips__hint">role para trocar a bobina · clique na tela para abrir</p>
      </div>

      {/* -------------------------------------------------------------- cinema */}
      {open !== null && (
        <div
          ref={modalRef}
          className="evom-clips__modal"
          role="dialog"
          aria-modal="true"
          aria-label="Reprodutor de clipe"
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) closeClip()
          }}
        >
          <button
            type="button"
            className="evom-clips__close"
            onClick={closeClip}
            aria-label="Fechar"
          >
            <svg viewBox="0 0 24 24" width="20" height="20">
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div ref={frameRef} className="evom-clips__frame">
            <video
              ref={videoRef}
              src={current.src}
              playsInline
              preload="auto"
              onClick={() => setPlaying((p) => !p)}
            />

            <div className="evom-clips__controls">
              <button
                type="button"
                className="evom-clips__toggle"
                onClick={() => setPlaying((p) => !p)}
                aria-label={playing ? 'Pausar' : 'Tocar'}
              >
                {playing ? '❚❚' : '▶'}
              </button>

              <span className="evom-clips__t">{fmt(time)}</span>

              <div
                className="evom-clips__rail"
                role="slider"
                tabIndex={0}
                aria-label="Progresso"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
                onPointerDown={(e) => {
                  const r = e.currentTarget.getBoundingClientRect()
                  const v = videoRef.current
                  if (v && Number.isFinite(v.duration)) {
                    v.currentTime = ((e.clientX - r.left) / r.width) * v.duration
                  }
                }}
              >
                <span className="evom-clips__fill" style={{ transform: `scaleX(${progress})` }} />
              </div>

              <span className="evom-clips__t">{fmt(duration)}</span>

              <button
                type="button"
                className="evom-clips__sound"
                onClick={() => {
                  const v = videoRef.current
                  if (!v) return
                  v.muted = !v.muted
                  setMuted(v.muted)
                }}
                aria-label={muted ? 'Ativar som' : 'Silenciar'}
              >
                {muted ? 'som off' : 'som on'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
