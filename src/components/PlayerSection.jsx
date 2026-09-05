import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { CAPAS, TRACKLIST, spotifyForTrack, spotifyForAlbum } from '../assets.js'
import './PlayerSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Ouça o projeto — a vitrola, agora com o disco na mão.
 *
 * A seção era um cover flow. O problema não era o acabamento: as 16 faixas
 * dividem UMA capa, então o carrossel exibia dezesseis imagens idênticas e a
 * premissa da mecânica — folhear artes diferentes — desmontava sozinha.
 *
 * Uma vitrola resolve pela raiz. O disco é um só, como no mundo real; a capa
 * vira a bolacha central, que é exatamente o lugar dela num vinil; e as faixas
 * deixam de ser imagens para virar POSIÇÕES no sulco.
 *
 * Faltava a parte que fazia disso um objeto e não um desenho de objeto: a mão.
 * Agora existem os dois gestos que se faz com um vinil, e nenhum deles é um
 * botão disfarçado:
 *
 *   ARRASTAR o disco  gira a bolacha sob o dedo e passa as faixas, como quem
 *                     procura um trecho girando o prato com a mão
 *   TOCAR num sulco   pousa a agulha ali — o raio do ponto tocado É a faixa,
 *                     que é literalmente como um vinil é endereçado
 *
 * A lista ao lado continua clicável e navegável por teclado, e o próprio disco
 * responde às setas: o gesto é o caminho bonito, nunca o único caminho.
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

// Os mesmos dois raios, agora do lado de cá: onde começa e onde acaba a área
// gravada, em fração do raio. Toque fora dessa faixa não endereça faixa
// nenhuma — é a borda lisa do disco ou a bolacha central.
const GROOVE_OUT = 0.97
const GROOVE_IN = 0.4

// Quantos graus de arrasto valem uma faixa. Calibrado para uma volta completa
// varrer o disco inteiro: 360 / 16 = 22,5. Mais curto e o dedo passa cinco
// faixas sem querer; mais longo e girar o disco não parece fazer nada.
const DEG_PER_TRACK = 22.5

const clamp = (v, a, b) => Math.min(Math.max(v, a), b)

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
  const [grabbing, setGrabbing] = useState(false)
  const [tocado, setTocado] = useState(false)

  const rootRef = useRef(null)
  const armRef = useRef(null)
  const listRef = useRef(null)
  const platterRef = useRef(null)
  const discRef = useRef(null)

  // A rotação do disco passa a ser um tween do GSAP, não uma animação CSS.
  //
  // Com @keyframes não há como pegar o disco no meio do giro: pausar prende o
  // ângulo no que o CSS decidir e retomar salta. Um tween infinito mantém a
  // rotação como um número que dá para ler e escrever — que é exatamente o que
  // permite o dedo assumir o controle no meio da volta e devolver de onde
  // parou.
  const spinRef = useRef(null)
  useEffect(() => {
    const disc = discRef.current
    if (!disc) return
    // 1,8s por volta = 33⅓ rpm. Usar a rotação real em vez de um número
    // arbitrário é o que faz o movimento parecer certo sem ninguém saber por quê.
    spinRef.current = gsap.to(disc, {
      rotation: '+=360',
      duration: 1.8,
      ease: 'none',
      repeat: -1,
    })
    return () => spinRef.current?.kill()
  }, [])

  useEffect(() => {
    const t = spinRef.current
    if (!t) return
    if (spinning && !grabbing) t.play()
    else t.pause()
  }, [spinning, grabbing])

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

    // Com o disco na mão o braço acompanha na hora. O amortecimento de 0,9s é
    // bonito quando a faixa vem da lista e é errado quando vem do dedo: a
    // agulha chegaria depois que a mão já parou.
    gsap.to(arm, {
      rotate,
      duration: grabbing ? 0.18 : 0.9,
      ease: grabbing ? 'power2.out' : 'power3.inOut',
      overwrite: 'auto',
    })
  }, [index, tracks.length, grabbing])

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

  /* ------------------------------------------------------------- o gesto -- */

  // O estado do arrasto vive fora do React de propósito: ele muda a cada
  // pointermove, e um setState por evento de ponteiro re-renderizaria dezesseis
  // itens de lista a 120 Hz para não mostrar nada de diferente.
  const drag = useRef({ active: false, lastAngle: 0, acc: 0, moved: 0 })

  const centro = () => {
    const r = platterRef.current.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, raio: r.width / 2 }
  }

  const anguloDe = (e, c) => (Math.atan2(e.clientY - c.y, e.clientX - c.x) * 180) / Math.PI

  const onPointerDown = (e) => {
    if (!platterRef.current) return
    const c = centro()
    drag.current = { active: true, lastAngle: anguloDe(e, c), acc: 0, moved: 0 }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    setGrabbing(true)
    setTocado(true)
  }

  const onPointerMove = (e) => {
    const d = drag.current
    if (!d.active || !platterRef.current || !discRef.current) return

    const c = centro()
    const a = anguloDe(e, c)

    // Diferença angular normalizada para (-180, 180]. Sem isso a passagem pelo
    // corte de 180° vira um salto de 360 graus e o disco dá um pinote.
    let delta = a - d.lastAngle
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    d.lastAngle = a
    d.moved += Math.abs(delta)

    // O disco gira sob o dedo.
    gsap.set(discRef.current, { rotation: '+=' + delta })

    // E o giro acumulado vira faixa. Horário (delta positivo) avança.
    d.acc += delta
    const passos = Math.trunc(d.acc / DEG_PER_TRACK)
    if (passos !== 0) {
      d.acc -= passos * DEG_PER_TRACK
      setIndex((i) => clamp(i + passos, 0, tracks.length - 1))
    }
  }

  const onPointerUp = (e) => {
    const d = drag.current
    if (!d.active) return
    d.active = false
    e.currentTarget.releasePointerCapture?.(e.pointerId)
    setGrabbing(false)

    // Movimento curto é toque, não arrasto: pousa a agulha no raio tocado.
    //
    // O limiar é angular porque o gesto é angular. Seis graus acumulados é
    // menos do que o tremor da mão em qualquer tela e mais do que zero, que
    // transformaria todo clique num arrasto de uma faixa.
    if (d.moved < 6) {
      const c = centro()
      const dist = Math.hypot(e.clientX - c.x, e.clientY - c.y) / c.raio
      if (dist <= GROOVE_OUT && dist >= GROOVE_IN) {
        // De fora para dentro = da primeira para a última, que é a ordem em que
        // um sulco é gravado.
        const t = (GROOVE_OUT - dist) / (GROOVE_OUT - GROOVE_IN)
        setIndex(clamp(Math.round(t * (tracks.length - 1)), 0, tracks.length - 1))
      }
    }
  }

  const current = tracks[index]

  const passo = useCallback(
    (n) => setIndex((i) => clamp(i + n, 0, tracks.length - 1)),
    [tracks.length]
  )

  const onListKey = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      passo(1)
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      passo(-1)
    }
  }

  const onPlatterKey = (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      passo(1)
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      passo(-1)
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
        {/* O prato inteiro é o controle, e não um botão dentro dele: quem pega
            um disco pega pela superfície. role="slider" porque é exatamente o
            que ele é — um valor contínuo entre a primeira e a última faixa. */}
        <div
          ref={platterRef}
          className={`evom-player__platter${grabbing ? ' is-grabbing' : ''}${
            tocado ? ' is-tocado' : ''
          }`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onPlatterKey}
          role="slider"
          tabIndex={0}
          aria-label="Disco: arraste para passar as faixas, toque num sulco para pousar a agulha"
          aria-valuemin={1}
          aria-valuemax={tracks.length}
          aria-valuenow={index + 1}
          aria-valuetext={current.title}
        >
          <div ref={discRef} className="evom-player__disc">
            {/* Sulcos em gradiente: um vinil tem centenas de anéis, e nenhum
                bitmap acompanharia a rotação sem serrilhar. */}
            <span className="evom-player__grooves" aria-hidden="true" />
            <img
              className="evom-player__label"
              src={CAPAS.euVenciOMundo}
              alt=""
              aria-hidden="true"
              draggable="false"
            />
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

          {/* A instrução some no primeiro toque: quem já descobriu o gesto não
              precisa continuar sendo instruído sobre ele. */}
          <span className="evom-player__grab" aria-hidden="true">
            arraste o disco
          </span>
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
            onKeyDown={onListKey}
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
