import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CAPAS, TRACKLIST } from '../assets.js'
import { readMotionMode, CALM } from '../motion.js'
import './PlayerSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * "Ouça o projeto" — cover flow 3D das 16 faixas de Eu Venci o Mundo.
 *
 * Mecânica própria de novo: aqui quem manda não é o scroll, é o arrasto. É a
 * primeira seção do site em que o usuário controla a coisa com a mão em vez de
 * com a rolagem, o que a separa por completo dos capítulos anteriores.
 *
 * Sobre o áudio: o projeto não tem arquivos de prévia. Em vez de inventar
 * durações e um player de mentira, o componente aceita `previewSrc` por faixa e
 * se vira sem ele — a barra roda como animação visual e o tempo total aparece
 * como "--:--" até existir áudio de verdade. Quando os arquivos chegarem, basta
 * preencher PREVIEWS e o player passa a tocar sem mudar mais nada.
 */

// Quando houver prévias licenciadas, mapear aqui: { 'Taylor': '/previews/taylor.m4a' }
const PREVIEWS = {}

const VISUAL_CYCLE = 30 // segundos que a barra leva no modo sem áudio

const fmt = (s) => {
  if (!Number.isFinite(s)) return '--:--'
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function PlayerSection() {
  const [calm] = useState(() => readMotionMode() === CALM)

  const tracks = useMemo(
    () =>
      TRACKLIST.map((title, i) => ({
        title,
        n: String(i + 1).padStart(2, '0'),
        cover: CAPAS.euVenciOMundo,
        previewSrc: PREVIEWS[title] || null,
      })),
    []
  )

  const [index, setIndex] = useState(3) // "Artista Genérico", a do exemplo do briefing
  const [playing, setPlaying] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(null)

  const rootRef = useRef(null)
  const trackRef = useRef(null)
  const audioRef = useRef(null)
  const dragRef = useRef({ active: false, startX: 0, moved: 0 })

  const current = tracks[index]
  const total = duration ?? (current.previewSrc ? null : VISUAL_CYCLE)

  const go = useCallback(
    (delta) => {
      setIndex((i) => Math.min(tracks.length - 1, Math.max(0, i + delta)))
      setElapsed(0)
    },
    [tracks.length]
  )

  // ------------------------------------------------------------ o carrossel
  // Cada card é posicionado por transform apenas (translateX/Z + rotateY), o
  // que mantém a coisa no compositor — nada de left/width mudando por frame.
  useEffect(() => {
    const cards = trackRef.current?.children
    if (!cards) return

    Array.from(cards).forEach((card, i) => {
      const offset = i - index
      const far = Math.abs(offset) > 3
      gsap.to(card, {
        xPercent: offset * 62,
        z: -Math.abs(offset) * 190,
        rotateY: offset === 0 ? 0 : offset > 0 ? -34 : 34,
        scale: offset === 0 ? 1 : 0.82,
        autoAlpha: far ? 0 : offset === 0 ? 1 : 0.5,
        duration: calm ? 0.2 : 0.72,
        ease: calm ? 'none' : 'power3.out',
        overwrite: 'auto',
      })
      card.style.zIndex = String(100 - Math.abs(offset))
    })
  }, [index, calm])

  // --------------------------------------------------------- entrada no scroll
  useEffect(() => {
    const root = rootRef.current
    if (!root || calm) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        root.querySelectorAll('.evom-player__reveal'),
        { autoAlpha: 0, y: 40 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          stagger: 0.12,
          ease: 'power2.out',
          scrollTrigger: { trigger: root, start: 'top 72%' },
        }
      )
    }, root)
    return () => ctx.revert()
  }, [calm])

  // -------------------------------------------------------------- o "player"
  // Com áudio: o elemento manda. Sem áudio: um relógio visual, deixando claro
  // na interface que não há prévia — nunca fingindo que tem.
  useEffect(() => {
    if (!playing) return

    const audio = audioRef.current
    if (audio && current.previewSrc) {
      audio.play().catch(() => setPlaying(false))
      const onTime = () => setElapsed(audio.currentTime)
      const onMeta = () => setDuration(audio.duration)
      audio.addEventListener('timeupdate', onTime)
      audio.addEventListener('loadedmetadata', onMeta)
      return () => {
        audio.pause()
        audio.removeEventListener('timeupdate', onTime)
        audio.removeEventListener('loadedmetadata', onMeta)
      }
    }

    let raf = 0
    let last = performance.now()
    const tick = (now) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - last) / 1000, 0.25)
      last = now
      setElapsed((e) => (e + dt) % VISUAL_CYCLE)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, current.previewSrc])

  useEffect(() => {
    setDuration(null)
    setElapsed(0)
  }, [index])

  // ------------------------------------------------------------ arrasto/toque
  const onPointerDown = (e) => {
    dragRef.current = { active: true, startX: e.clientX, moved: 0 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e) => {
    const d = dragRef.current
    if (!d.active) return
    d.moved = e.clientX - d.startX
    // Um card por gesto: passar N de uma vez desorienta e some com o
    // encadeamento visual que a seção depende.
    if (Math.abs(d.moved) > 70) {
      go(d.moved < 0 ? 1 : -1)
      d.active = false
    }
  }

  const endDrag = () => {
    dragRef.current.active = false
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1) }
  }

  const progress = total ? Math.min(elapsed / total, 1) : 0

  return (
    <section ref={rootRef} className="evom-player" aria-label="Ouça o projeto">
      {/* Fundo reativo: a capa da faixa atual, ampliada e desfocada. Trocar de
          faixa faz o fundo respirar junto, sem flash. */}
      <div
        className="evom-player__bg"
        style={{ backgroundImage: `url(${current.cover})` }}
        aria-hidden="true"
      />
      <div className="evom-player__bg-tint" aria-hidden="true" />

      <header className="evom-player__head evom-player__reveal">
        <p className="evom-player__eyebrow">16 faixas</p>
        <h2 className="evom-player__title">OUÇA O PROJETO.</h2>
      </header>

      <div
        className="evom-player__stage evom-player__reveal"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        role="group"
        aria-roledescription="carrossel"
        aria-label="Faixas do álbum. Use as setas do teclado para navegar."
        tabIndex={0}
      >
        <div ref={trackRef} className="evom-player__track">
          {tracks.map((t, i) => (
            <article
              key={t.title}
              className={`evom-player__card${i === index ? ' is-current' : ''}`}
              onClick={() => i !== index && go(i - index)}
              aria-current={i === index}
            >
              <img src={t.cover} alt="" aria-hidden="true" draggable="false" loading="lazy" />
              <div className="evom-player__card-face">
                <span className="evom-player__card-n">{t.n}</span>
                <span className="evom-player__card-title">{t.title}</span>
              </div>
            </article>
          ))}
        </div>

        <span className="evom-player__drag-hint" aria-hidden="true">
          arraste
        </span>
      </div>

      <div className="evom-player__bar evom-player__reveal">
        <div className="evom-player__now">
          <p className="evom-player__now-title">{current.title}</p>
          <p className="evom-player__now-meta">
            VEIGH <span aria-hidden="true">·</span> EU VENCI O MUNDO
          </p>
        </div>

        <div className="evom-player__controls">
          <button
            type="button"
            className="evom-player__nav"
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="Faixa anterior"
          >
            ‹
          </button>

          <button
            type="button"
            className="evom-player__play"
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? 'Pausar' : 'Tocar'}
          >
            {playing ? '❚❚' : '▶'}
          </button>

          <button
            type="button"
            className="evom-player__nav"
            onClick={() => go(1)}
            disabled={index === tracks.length - 1}
            aria-label="Próxima faixa"
          >
            ›
          </button>
        </div>

        <div className="evom-player__progress">
          <span className="evom-player__time">{fmt(elapsed)}</span>
          <div
            className="evom-player__rail"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span className="evom-player__fill" style={{ transform: `scaleX(${progress})` }} />
          </div>
          <span className="evom-player__time">{fmt(duration ?? NaN)}</span>
        </div>
      </div>

      {!current.previewSrc && (
        <p className="evom-player__note evom-player__reveal">
          Prévias de áudio não disponíveis neste projeto — o player está completo,
          só sem som.
        </p>
      )}

      {current.previewSrc && <audio ref={audioRef} src={current.previewSrc} preload="none" />}
    </section>
  )
}
