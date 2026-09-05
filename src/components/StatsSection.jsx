import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { createSky } from './skyScene.js'
import './StatsSection.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Números monumentais, sobre o céu dourado.
 *
 * Esta é a única seção clara do site, e é de propósito: doze capítulos
 * seguidos no escuro achatam a percepção, e um respiro luminoso no meio faz
 * o vinho voltar a pesar quando o site escurece de novo. O céu é o mesmo
 * clipe da intro — o material que abriu a experiência volta como ambiente,
 * fechando um laço em vez de introduzir um asset novo.
 *
 * Nada de quatro cards lado a lado: cada número ocupa a tela sozinho, e o
 * primeiro é preenchido pelo vídeo — o algarismo é uma janela, não um texto
 * colorido. Os contadores sobem com o scroll, não com um timer.
 *
 * Os valores vieram do briefing. Os dois últimos aparecem lá como exemplo de
 * layout, então estão marcados para você confirmar antes de ir ao ar.
 */
const STATS = [
  { value: 5, suffix: 'BI+', label: 'streams', decimals: 0 },
  { value: 12, suffix: 'MI', label: 'ouvintes mensais', decimals: 0, confirm: true },
  { value: 50, prefix: 'TOP ', suffix: '', label: 'global', decimals: 0, confirm: true },
  { value: 30, prefix: 'UNDER ', suffix: '', label: 'Forbes', decimals: 0 },
]

/**
 * Uma roda de dígito por casa decimal, como num odômetro de painel.
 *
 * A versão anterior trocava o textContent a cada quadro. Funcionava, mas
 * substituir um glifo por outro não é a mesma leitura de um número que ROLA:
 * o odômetro é o objeto que a cultura associa a distância percorrida, e é
 * exatamente disso que a seção fala. Cada roda carrega 0-9 mais um 0 no fim,
 * porque sem o décimo-primeiro quadro a passagem de 9 para 0 volta a fita
 * inteira de baixo para cima em vez de continuar girando.
 */
function Odometer({ value }) {
  const places = String(value).length
  return (
    <span className="evom-odo" data-value={value} role="text" aria-label={String(value)}>
      {Array.from({ length: places }, (_, i) => (
        <span className="evom-odo__wheel" key={i} aria-hidden="true">
          <span className="evom-odo__strip">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d, k) => (
              <span className="evom-odo__cell" key={k}>
                {d}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  )
}

export default function StatsSection() {
  const rootRef = useRef(null)
  const skyRef = useRef(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const ctx = gsap.context(() => {
      root.querySelectorAll('.evom-stats__item').forEach((item) => {
        const odo = item.querySelector('.evom-odo')
        const wheels = [...item.querySelectorAll('.evom-odo__strip')]
        const target = Number(odo.dataset.value)
        const counter = { v: 0 }

        // Onde cada roda para, dado o valor corrente.
        //
        // A roda das unidades gira contínua. As de cima NÃO: num odômetro de
        // verdade a dezena fica parada quase a volta toda e só vira junto no
        // fim, arrastada pela unidade. Sem isso todas as casas giram na mesma
        // proporção e o resultado é um borrão de meios-dígitos que nunca
        // mostra um número legível.
        const wheelAt = (v, place) => {
          const x = v / 10 ** place
          if (place === 0) return x % 10
          const base = Math.floor(x)
          const f = x - base
          return (base + (f < 0.9 ? 0 : (f - 0.9) / 0.1)) % 10
        }

        const paint = () => {
          wheels.forEach((strip, i) => {
            const place = wheels.length - 1 - i
            strip.style.setProperty('--d', wheelAt(counter.v, place).toFixed(4))
          })
        }
        paint()

        gsap
          .timeline({
            scrollTrigger: { trigger: item, start: 'top 82%', end: 'top 32%', scrub: 0.7 },
          })
          // O contador é scrubado: subir o número por timer faria o usuário
          // perder a contagem se chegasse tarde ou rolasse de volta.
          .to(
            counter,
            {
              v: target,
              ease: 'none',
              onUpdate: paint,
            },
            0
          )
          .fromTo(item, { autoAlpha: 0, y: 60 }, { autoAlpha: 1, y: 0, ease: 'power2.out' }, 0)

        // Sair também. Sem isso o número ficava aceso depois de passar, e dois
        // algarismos gigantes dividiam a tela — cada um tem que ser dono dela.
        gsap.to(item, {
          autoAlpha: 0,
          y: -60,
          ease: 'power2.in',
          scrollTrigger: { trigger: item, start: 'bottom 72%', end: 'bottom 18%', scrub: 0.7 },
        })

        // Parallax do rótulo: entra mais devagar que o número, criando camada.
        gsap.to(item.querySelector('.evom-stats__label'), {
          yPercent: -26,
          ease: 'none',
          scrollTrigger: { trigger: item, start: 'top bottom', end: 'bottom top', scrub: 1 },
        })
      })
    }, root)

    // O céu: renderiza só enquanto a seção está na tela, e o sol sobe com o
    // progresso do scroll.
    const sky = createSky(skyRef.current)
    let st = null
    if (sky) {
      st = ScrollTrigger.create({
        trigger: root,
        start: 'top bottom',
        end: 'bottom top',
        onUpdate: (self) => sky.setProgress(self.progress),
        onToggle: (self) => (self.isActive ? sky.start() : sky.stop()),
      })
      if (st.isActive) sky.start()
    }

    return () => {
      st?.kill()
      sky?.dispose()
      ctx.revert()
    }
  }, [])

  return (
    <section ref={rootRef} className="evom-stats" aria-label="Números">
      {/* O céu vive DENTRO da seção: wrapper absoluto do tamanho dela, com o
          canvas em sticky por dentro. A versão anterior usava position: fixed
          e o céu vazou para a página inteira — fixed se prende à viewport, e o
          clip-path que eu tinha posto estava no próprio elemento fixo, onde
          não contém nada. */}
      <div className="evom-stats__skywrap" aria-hidden="true">
        <canvas ref={skyRef} className="evom-stats__sky" />
        <span className="evom-stats__haze" />
      </div>

      {STATS.map((s) => (
        <div className="evom-stats__item" key={s.label}>
          <p className="evom-stats__num">
            {/* Prefixo e sufixo em spans próprios: dentro de um flex, texto
                solto vira item anônimo e o espaço de "TOP " colapsa. */}
            <span className="evom-stats__num-text">
              {s.prefix ? <span className="evom-stats__fix">{s.prefix}</span> : null}
              <Odometer value={s.value} />
              {s.suffix ? <span className="evom-stats__fix">{s.suffix}</span> : null}
            </span>
          </p>
          <p className="evom-stats__label">{s.label}</p>
        </div>
      ))}
    </section>
  )
}
