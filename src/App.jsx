import { useState } from 'react'
import IntroSequence from './components/IntroSequence.jsx'
import HistorySection from './components/HistorySection.jsx'

export default function App() {
  const [introSeen, setIntroSeen] = useState(false)

  return (
    <>
      {/* A intro agora vive no fluxo do documento: é a altura dela que dá o
          curso de scroll. O site continua logo abaixo, normalmente. */}
      <IntroSequence onIntroComplete={() => setIntroSeen(true)} />

      <main className="site" data-intro-seen={introSeen}>
        {/* Seção 1 — A História. Palco sticky próprio, logo abaixo da intro. */}
        <HistorySection />

        {/* Placeholder: existe só pra demonstrar a troca de seção no fim da
            intro. A hero real (capa do álbum + reveal no scroll) entra aqui. */}
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
