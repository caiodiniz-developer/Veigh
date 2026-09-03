import { useState } from 'react'
import IntroSequence from './components/IntroSequence.jsx'

export default function App() {
  const [introSeen, setIntroSeen] = useState(false)

  return (
    <>
      {/* A intro agora vive no fluxo do documento: é a altura dela que dá o
          curso de scroll. O site continua logo abaixo, normalmente. */}
      <IntroSequence onIntroComplete={() => setIntroSeen(true)} />

      <main className="site" data-intro-seen={introSeen}>
        <section className="hero-placeholder">
          <p>Hero do site (capa do álbum + reveal no scroll) entra aqui.</p>
          <p className="hero-placeholder__flag">
            introSeen: <strong>{String(introSeen)}</strong>
          </p>
        </section>
      </main>
    </>
  )
}
