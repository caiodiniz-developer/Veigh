import { useState } from 'react'
import IntroSequence from './components/IntroSequence.jsx'

export default function App() {
  const [introDone, setIntroDone] = useState(false)

  return (
    <>
      {/* O site fica montado por baixo desde o começo: é ele que a saída da
          intro revela. `introDone` é o gancho pra hero disparar o próprio
          reveal (capa do álbum + scroll) — implementação em outra tarefa. */}
      <main className="site" data-intro-done={introDone}>
        <section className="hero-placeholder">
          <p>Hero do site (capa do álbum + reveal no scroll) entra aqui.</p>
          <p className="hero-placeholder__flag">
            introDone: <strong>{String(introDone)}</strong>
          </p>
        </section>
      </main>

      <IntroSequence onFinish={() => setIntroDone(true)} />
    </>
  )
}
