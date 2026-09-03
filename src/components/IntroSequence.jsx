import { useCallback, useEffect, useRef, useState } from 'react'
import './IntroSequence.css'

/**
 * Intro cinematográfica do EVOM, em 3 atos:
 *   Ato 1  vídeo fullscreen (mãos -> coração)
 *   Ato 2  hard cut para o fundo vinho (sem fade, sem dissolve)
 *   Ato 3  pingentes E V O M entrando em sequência + "Eu Venci o Mundo."
 *   Saída  fade/slide-up revelando o site
 *
 * Roda uma única vez por visita. Chama onFinish() quando termina (ou quando é pulada),
 * que é o gancho pra página montar a hero.
 */

// Flag em memória (escopo de módulo): remounts do React não reproduzem a intro de novo.
// Só vira true quando a intro de fato termina ou é pulada.
let hasPlayed = false

const DEFAULT_LETTERS = ['/e.png', '/v.png', '/o.png', '/m.png']

// --- Ato 3, em ms -----------------------------------------------------------
const LETTER_STEP = 300 // intervalo entre o início de uma letra e o da próxima
const LETTER_DUR = 420 // duração do scale-up de cada letra
const MANIFESTO_AT = LETTER_STEP * 3 + LETTER_DUR // entra quando o M assenta (~1260ms)
const MANIFESTO_DUR = 620
const HOLD = 900 // pausa com tudo estático pro usuário ler
const ACT3_TOTAL = MANIFESTO_AT + MANIFESTO_DUR + HOLD

const EXIT_DUR = 900 // saída natural
const SKIP_EXIT_DUR = 320 // saída ao clicar em "Pular intro"
const STATIC_HOLD = 1800 // hold do modo prefers-reduced-motion

const CUT_LEAD = 0.25 // s antes do fim do vídeo em que o corte crava
const VIDEO_LOAD_TIMEOUT = 4000 // se o vídeo nem começar a tocar, cai pro Ato 3
const VIDEO_OVERRUN = 1200 // folga sobre o tempo restante, caso 'ended' não dispare
const SKIP_AFTER = 1000 // botão "Pular intro" aparece depois de 1s

export default function IntroSequence({
  onFinish,
  videoSrc = '/hero.mp4',
  letters = DEFAULT_LETTERS,
  manifesto = 'Eu Venci o Mundo.',
}) {
  const [reduced] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  // 'video' -> 'letters' -> 'exit' -> 'done'
  const [phase, setPhase] = useState(() => {
    if (hasPlayed) return 'done'
    return reduced ? 'letters' : 'video'
  })
  const [showSkip, setShowSkip] = useState(false)
  const [exitMs, setExitMs] = useState(EXIT_DUR)

  const videoRef = useRef(null)
  const finishedRef = useRef(false)

  const finish = useCallback(() => {
    if (finishedRef.current) return
    finishedRef.current = true
    hasPlayed = true
    setPhase('done')
    onFinish?.()
  }, [onFinish])

  // Ato 2: o corte. Trocar de fase já basta — o vídeo some no mesmo frame
  // em que o vinho aparece, porque o vinho é o fundo do container.
  const cutToLetters = useCallback(() => {
    setPhase((p) => (p === 'video' ? 'letters' : p))
  }, [])

  const skip = useCallback(() => {
    setExitMs(SKIP_EXIT_DUR)
    setPhase((p) => (p === 'done' ? p : 'exit'))
  }, [])

  // Se a intro já rodou nesta visita, avisa a página na hora.
  useEffect(() => {
    if (phase === 'done') finish()
  }, [phase, finish])

  // Pré-carrega os pingentes durante o Ato 1 pra não piscarem no Ato 3.
  useEffect(() => {
    const imgs = letters.map((src) => {
      const img = new Image()
      img.src = src
      return img
    })
    return () => imgs.forEach((img) => (img.src = ''))
  }, [letters])

  // Trava o scroll enquanto a intro está na tela.
  useEffect(() => {
    if (phase === 'done') return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [phase])

  // Botão "Pular intro".
  useEffect(() => {
    if (phase === 'done') return
    const t = setTimeout(() => setShowSkip(true), SKIP_AFTER)
    return () => clearTimeout(t)
  }, [phase])

  // Ato 1: dispara o play e mantém um failsafe caso o vídeo não colabore
  // (autoplay bloqueado, arquivo pesado, erro de rede). Enquanto ele não toca,
  // o que está na tela já é o vinho do Ato 2 — nunca um frame branco.
  useEffect(() => {
    if (phase !== 'video') return
    const video = videoRef.current
    if (!video) return

    let failsafe = setTimeout(cutToLetters, VIDEO_LOAD_TIMEOUT)
    const onPlaying = () => {
      clearTimeout(failsafe)
      const remaining = Number.isFinite(video.duration)
        ? (video.duration - video.currentTime) * 1000
        : VIDEO_LOAD_TIMEOUT
      failsafe = setTimeout(cutToLetters, remaining + VIDEO_OVERRUN)
    }

    video.addEventListener('playing', onPlaying)
    const played = video.play()
    if (played && typeof played.catch === 'function') played.catch(cutToLetters)

    return () => {
      clearTimeout(failsafe)
      video.removeEventListener('playing', onPlaying)
    }
  }, [phase, cutToLetters])

  // Ato 3 -> saída -> site.
  useEffect(() => {
    if (phase !== 'letters') return
    const t = setTimeout(() => setPhase('exit'), reduced ? STATIC_HOLD : ACT3_TOTAL)
    return () => clearTimeout(t)
  }, [phase, reduced])

  useEffect(() => {
    if (phase !== 'exit') return
    const t = setTimeout(finish, reduced ? 200 : exitMs)
    return () => clearTimeout(t)
  }, [phase, exitMs, reduced, finish])

  if (phase === 'done') return null

  const handleTimeUpdate = (event) => {
    const video = event.currentTarget
    if (!video.duration || Number.isNaN(video.duration)) return
    if (video.currentTime >= video.duration - CUT_LEAD) cutToLetters()
  }

  return (
    <div
      className={[
        'evom-intro',
        phase === 'exit' ? 'is-exiting' : '',
        reduced ? 'is-static' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        '--evom-exit-dur': `${reduced ? 200 : exitMs}ms`,
        '--evom-letter-dur': `${LETTER_DUR}ms`,
        '--evom-manifesto-dur': `${MANIFESTO_DUR}ms`,
        '--evom-manifesto-at': `${MANIFESTO_AT}ms`,
      }}
    >
      {phase === 'video' && (
        <video
          ref={videoRef}
          className="evom-intro__video"
          src={videoSrc}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onTimeUpdate={handleTimeUpdate}
          onEnded={cutToLetters}
          onError={cutToLetters}
        />
      )}

      {phase !== 'video' && (
        <div className="evom-intro__stage">
          <div className="evom-intro__letters" aria-hidden="true">
            {letters.map((src, index) => (
              <img
                key={src}
                className="evom-intro__letter"
                style={{ animationDelay: `${index * LETTER_STEP}ms` }}
                src={src}
                alt=""
                draggable="false"
              />
            ))}
          </div>

          <p className="evom-intro__manifesto">{manifesto}</p>
        </div>
      )}

      <button
        type="button"
        className={`evom-intro__skip${showSkip ? ' is-visible' : ''}`}
        onClick={skip}
        tabIndex={showSkip ? 0 : -1}
        aria-hidden={!showSkip}
      >
        Pular intro
      </button>
    </div>
  )
}
