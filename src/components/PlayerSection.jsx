import { useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CAPAS, TRACKLIST, spotifyForTrack, spotifyForAlbum } from '../assets.js'
import './PlayerSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Ouça o projeto — a vitrola.
 *
 * A seção era um cover flow. O problema não era o acabamento: as 16 faixas
 * dividem UMA capa, então o carrossel exibia dezesseis imagens idênticas e a
 * premissa da mecânica — folhear artes diferentes — desmontava sozinha.
 *
 * Uma vitrola resolve pela raiz. O disco é um só, como no mundo real; a capa
 * vira a bolacha central, que é exatamente o lugar dela num vinil; e as faixas
 * deixam de ser imagens para virar POSIÇÕES no sulco. Escolher uma música
 * passa a ser mover o braço, que é o gesto do objeto.
 *
 * Sem áudio no projeto, o disco gira mas a agulha não finge tocar o que não
 * existe: quem leva ao som é o link do Spotify.
 */

// Ângulo do braço, do primeiro ao último sulco.
//
// Não são números escolhidos a olho: saem da geometria montada no CSS. O pivô
// está no canto superior direito do prato, a 0,707 da largura do centro — ou
// seja, a 1,41 raio, a mesma proporção de um toca-discos real. Com o braço
// medindo 1,53 raio, a lei dos cossenos dá o ângulo em que a cápsula pousa em
// cada raio do disco, contado a partir da direção que aponta para o eixo (45°,
// já que o pivô está na diagonal):
//
//   sulco externo  r = 0,97 R  ->  45° - 38,3°  =   7°
//   sulco interno  r = 0,40 R  ->  45° - 14,9°  =  30°
//
// A varredura de 23° não é uma decisão de design; é quanto um braço de vitrola
// realmente percorre de fora a dentro. E o sinal é POSITIVO: em CSS a rotação
// positiva é horária, e é ela que traz a agulha para cima do disco.
const ARM_START = 7
const ARM_END = 30

export default function PlayerSection() {
  const tracks = useMemo(
    () =>
      TRACKLIST.map((title, i) => ({
        title,
        n: String(i + 1).padStart(2, '0'),
        spotify: spotifyForTrack(title),
      })),
    []
  )

  const [index, setIndex] = useState(3) // "Artista Genérico", a do exemplo do briefing
  const [spinning, setSpinning] = useState(true)

  const rootRef = useRef(null)
  const armRef = useRef(null)
  const listRef = useRef(null)

  // O braço vai até o sulco da faixa. O ângulo é derivado do índice, então
  // acrescentar ou tirar faixas não exige recalcular nada.
  const armReady = useRef(false)
  useEffect(() => {
    const arm = armRef.current
    if (!arm) return
    const t = tracks.length > 1 ? index / (tracks.length - 1) : 0
    const rotate = ARM_START + (ARM_END - ARM_START) * t

    // Na montagem o braço já entra pousado no sulco certo. O GSAP lê a rotação
    // inicial do transform (que está vazio) como zero, então sem este atalho o
    // primeiro render mostraria o braço saindo do repouso sozinho, sem que
    // ninguém tivesse escolhido faixa nenhuma.
    if (!armReady.current) {
      armReady.current = true
      gsap.set(arm, { rotate })
      return
    }

    gsap.to(arm, { rotate, duration: 0.9, ease: 'power3.inOut', overwrite: 'auto' })
  }, [index, tracks.length])

  // Mantém a faixa ativa visível na lista sem arrastar a página junto.
  useEffect(() => {
    const list = listRef.current
    const item = list?.children?.[index]
    if (!list || !item) return
    list.scrollTo({
      top: item.offsetTop - list.clientHeight / 2 + item.clientHeight / 2,
      behavior: 'smooth',
    })
  }, [index])

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
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
  }, [])

  const current = tracks[index]

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIndex((i) => Math.min(tracks.length - 1, i + 1))
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIndex((i) => Math.max(0, i - 1))
    }
  }

  return (
    <section ref={rootRef} className="evom-player" aria-label="Ouça o projeto">
      <div
        className="evom-player__bg"
        style={{ backgroundImage: `url(${CAPAS.euVenciOMundo})` }}
        aria-hidden="true"
      />
      <div className="evom-player__tint" aria-hidden="true" />

      <header className="evom-player__head evom-player__reveal">
        <p className="evom-player__eyebrow">16 faixas</p>
        <h2 className="evom-player__title">OUÇA O PROJETO.</h2>
      </header>

      <div className="evom-player__deck evom-player__reveal">
        <div className="evom-player__platter">
          <div className={`evom-player__disc${spinning ? ' is-spinning' : ''}`}>
            {/* Sulcos em gradiente: um vinil tem centenas de anéis, e nenhum
                bitmap acompanharia a rotação sem serrilhar. */}
            <span className="evom-player__grooves" aria-hidden="true" />
            <img className="evom-player__label" src={CAPAS.euVenciOMundo} alt="" aria-hidden="true" />
            <span className="evom-player__spindle" aria-hidden="true" />
          </div>

          {/* O reflexo fica FORA do elemento que gira. Reflexo que roda junto
              com o disco não é reflexo — é textura pintada nele. */}
          <span className="evom-player__sheen" aria-hidden="true" />

          {/* O poste é fixo; só a haste gira em torno dele. */}
          <span className="evom-player__post" aria-hidden="true" />

          <div ref={armRef} className="evom-player__arm" aria-hidden="true">
            <span className="evom-player__arm-weight" />
            <span className="evom-player__arm-rod" />
            <span className="evom-player__arm-head" />
          </div>
        </div>

        <div className="evom-player__side">
          <div className="evom-player__now">
            <p className="evom-player__now-n">{current.n}</p>
            <p className="evom-player__now-title">{current.title}</p>
            <p className="evom-player__now-meta">VEIGH · EU VENCI O MUNDO</p>

            <div className="evom-player__actions">
              <button
                type="button"
                className="evom-player__spin"
                onClick={() => setSpinning((s) => !s)}
                aria-pressed={spinning}
              >
                {spinning ? 'parar o disco' : 'girar o disco'}
              </button>

              <a
                className="evom-player__go"
                href={current.spotify}
                target="_blank"
                rel="noopener noreferrer"
              >
                ouvir no Spotify &#8599;
              </a>
            </div>
          </div>

          <ol
            ref={listRef}
            className="evom-player__list"
            onKeyDown={onKeyDown}
            tabIndex={0}
            aria-label="Faixas do álbum"
          >
            {tracks.map((t, i) => (
              <li key={t.title}>
                <button
                  type="button"
                  className={`evom-player__track${i === index ? ' is-on' : ''}`}
                  onClick={() => setIndex(i)}
                  aria-current={i === index}
                >
                  <span className="evom-player__track-n">{t.n}</span>
                  <span className="evom-player__track-name">{t.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <p className="evom-player__note evom-player__reveal">
        <a href={spotifyForAlbum()} target="_blank" rel="noopener noreferrer">
          Ouvir o álbum completo no Spotify
        </a>
      </p>
    </section>
  )
}
