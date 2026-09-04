import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CLIPES } from '../assets.js'
import './ClipsSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Clipes — a sala de projeção do site.
 *
 * Cards de vidro numa fita horizontal; clicar em um abre o vídeo em tela cheia
 * partindo da posição exata do card (FLIP manual), com o fundo escurecendo e
 * desfocando. Fecha no ESC, no clique fora e no botão.
 *
 * Sobre os metadados: os seis arquivos chegaram como "video curto 1..6", sem
 * título, data ou contagem de views. Duração eu leio do próprio arquivo — esse
 * dado é real. Título, ano, tipo e views ficam como campos opcionais aqui:
 * o card só desenha o que existe, então nada aparece inventado. Preencha
 * abaixo e a interface passa a mostrar sozinha.
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

export default function ClipsSection() {
  const rootRef = useRef(null)
  const tapeRef = useRef(null)
  const cardRefs = useRef([])
  const previewRefs = useRef([])

  const modalRef = useRef(null)
  const frameRef = useRef(null)
  const videoRef = useRef(null)
  const openerRef = useRef(null) // para devolver o foco ao fechar

  const [open, setOpen] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(NaN)
  const [muted, setMuted] = useState(false)
  const [durations, setDurations] = useState({})

  // ------------------------------------------------------------ fita horizontal
  useEffect(() => {
    const root = rootRef.current
    const tape = tapeRef.current
    if (!root || !tape) return

    const ctx = gsap.context(() => {
      const distance = () => Math.max(0, tape.scrollWidth - window.innerWidth * 0.88)
      gsap.to(tape, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: root,
          start: 'top top',
          end: () => '+=' + distance(),
          scrub: 0.7,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
        },
      })
    }, root)

    return () => ctx.revert()
  }, [])

  // Duração real de cada clipe, lida do arquivo. preload="metadata" baixa só o
  // cabeçalho — alguns segundos de rede, não os 8 a 21 MB de cada vídeo.
  useEffect(() => {
    const els = previewRefs.current.filter(Boolean)
    const onMeta = (e) => {
      const i = els.indexOf(e.target)
      if (i >= 0) setDurations((d) => ({ ...d, [i]: e.target.duration }))
    }
    els.forEach((el) => el.addEventListener('loadedmetadata', onMeta))
    return () => els.forEach((el) => el.removeEventListener('loadedmetadata', onMeta))
  }, [])

  // ------------------------------------------------------------------- abertura
  const openClip = useCallback((i, cardEl) => {
    openerRef.current = cardEl
    setOpen(i)
  }, [])

  const closeClip = useCallback(() => {
    const modal = modalRef.current
    const frame = frameRef.current
    const card = openerRef.current
    if (!modal || !frame) return setOpen(null)

    // Volta encolhendo para o card de origem — o inverso exato da abertura.
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

  // FLIP manual: o vídeo nasce exatamente sobre o card e cresce até a tela.
  // Sem plugin — Flip é pago; medir os dois retângulos e interpolar dá o mesmo
  // resultado e mantém a origem do movimento no card que foi clicado.
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

  // ------------------------------------------------------- tilt e brilho no card
  const onCardMove = (e, i) => {
    const card = cardRefs.current[i]
    if (!card) return
    const r = card.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    card.style.setProperty('--tilt-y', `${(px - 0.5) * 13}deg`)
    card.style.setProperty('--tilt-x', `${(0.5 - py) * 9}deg`)
    card.style.setProperty('--gloss-x', `${px * 100}%`)
    card.style.setProperty('--gloss-y', `${py * 100}%`)
    // Sombra acompanhando a inclinação: luz vindo de cima-esquerda.
    card.style.setProperty('--sx', `${(0.5 - px) * 26}px`)
    card.style.setProperty('--sy', `${(0.5 - py) * 20 + 26}px`)
  }

  const onCardLeave = (i) => {
    const card = cardRefs.current[i]
    if (!card) return
    card.style.setProperty('--tilt-y', '0deg')
    card.style.setProperty('--tilt-x', '0deg')
    card.style.setProperty('--sx', '0px')
    card.style.setProperty('--sy', '26px')
    const v = previewRefs.current[i]
    if (v) {
      v.pause()
      v.currentTime = 0
    }
  }

  const onCardEnter = (i) => {
    if (open !== null) return
    const v = previewRefs.current[i]
    v?.play().catch(() => {})
  }

  const progress = Number.isFinite(duration) && duration > 0 ? time / duration : 0
  const current = open !== null ? CLIPS[open] : null

  return (
    <section ref={rootRef} className="evom-clips" aria-label="Clipes">
      <div className="evom-clips__stage">
        {/* O palco. Fundo, refletores, chão e fumaça rasteira — em camadas,
            de trás para a frente, como a montagem real de um palco. */}
        <div className="evom-clips__house" aria-hidden="true">
          <span className="evom-clips__backwall" />

          {/* Refletores: o cone é um trapézio com clip-path, não um gradiente
              retangular. É o corte que faz ler como feixe saindo de uma fonte
              pontual em vez de mancha vertical. */}
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

        <div ref={tapeRef} className="evom-clips__tape">
          {CLIPS.map((c, i) => (
            <span className="evom-clips__slot" key={c.src}>
            <button
              type="button"
              className="evom-clips__card"
              ref={(el) => {
                cardRefs.current[i] = el
              }}
              onPointerMove={(e) => onCardMove(e, i)}
              onPointerEnter={() => onCardEnter(i)}
              onPointerLeave={() => onCardLeave(i)}
              onClick={(e) => openClip(i, e.currentTarget)}
              aria-label={`Abrir clipe ${c.title || c.n}`}
            >
              <span className="evom-clips__gloss" aria-hidden="true" />

              <video
                ref={(el) => {
                  previewRefs.current[i] = el
                }}
                src={c.src}
                muted
                loop
                playsInline
                preload="metadata"
                disablePictureInPicture
                aria-hidden="true"
              />

              <span className="evom-clips__play" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path d="M8 5v14l11-7z" fill="currentColor" />
                </svg>
              </span>

              <span className="evom-clips__meta">
                <span className="evom-clips__n">{c.n}</span>
                {/* Só desenha o que existe: sem título, o card mostra o número
                    e a duração, e não um rótulo inventado. */}
                {c.title && <span className="evom-clips__name">{c.title}</span>}
                <span className="evom-clips__spacer" />
                {c.kind && <span className="evom-clips__tag">{c.kind}</span>}
                {c.year && <span className="evom-clips__tag">{c.year}</span>}
                {c.views && <span className="evom-clips__tag">{c.views}</span>}
                <span className="evom-clips__dur">{fmt(durations[i])}</span>
              </span>
            </button>

            {/* Poça de luz e sombra de contato: é o que assenta o card NO
                chão. Sem elas ele flutua e o palco vira papel de parede. */}
            <span className="evom-clips__pool" aria-hidden="true" />
            </span>
          ))}
        </div>

        <p className="evom-clips__hint">passe o mouse para pré-visualizar · clique para abrir</p>
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
