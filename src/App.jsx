import { useState } from 'react'
import MotionToggle from './components/MotionToggle.jsx'
import IntroSequence from './components/IntroSequence.jsx'
import ManifestoSection from './components/ManifestoSection.jsx'
import HistorySection from './components/HistorySection.jsx'
import TimelineSection from './components/TimelineSection.jsx'
import PlayerSection from './components/PlayerSection.jsx'

export default function App() {
  const [introSeen, setIntroSeen] = useState(false)

  return (
    <>
      {/* A intro agora vive no fluxo do documento: é a altura dela que dá o
          curso de scroll. O site continua logo abaixo, normalmente. */}
      <MotionToggle />

      <IntroSequence onIntroComplete={() => setIntroSeen(true)} />

      <main className="site" data-intro-seen={introSeen}>
        {/* Capítulo 1 — o manifesto tipográfico. As letras da última frase
            abrem e revelam a fotografia que vira o fundo do próximo capítulo. */}
        <ManifestoSection />

        {/* Capítulo 2 — A História. Palco sticky próprio. */}
        <HistorySection />

        {/* Capítulo 3 — a trajetória. Mecânica invertida em relação aos
            capítulos anteriores: aqui o conteúdo rola e só o trilho fica preso. */}
        <TimelineSection />

        {/* Capítulo 4 — Ouça o projeto. Primeira seção guiada pela mão
            (arrasto) em vez do scroll. */}
        <PlayerSection />

        {/* Placeholder: os capítulos seguintes (eras, player, discografia,
            galeria, clipes, shows, mundo, imprensa, final) entram aqui. */}
        <section className="next-section">
          <p className="next-section__eyebrow">Veigh</p>
          <h2 className="next-section__title">Eu Venci o Mundo</h2>
          <p className="next-section__note">
            Hero do site entra aqui — placeholder.
          </p>
          <p className="next-section__flag">
            introSeen: <strong>{String(introSeen)}</strong>
          </p>
        </section>
      </main>
    </>
  )
}
