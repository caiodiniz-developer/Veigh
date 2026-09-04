import { useState } from 'react'
import IntroSequence from './components/IntroSequence.jsx'
import ManifestoSection from './components/ManifestoSection.jsx'
import HistorySection from './components/HistorySection.jsx'
import TimelineSection from './components/TimelineSection.jsx'
import PlayerSection from './components/PlayerSection.jsx'
import ShatterSection from './components/ShatterSection.jsx'
import StatsSection from './components/StatsSection.jsx'
import DiscographySection from './components/DiscographySection.jsx'
import GallerySection from './components/GallerySection.jsx'
import ClipsSection from './components/ClipsSection.jsx'
import ShowsSection from './components/ShowsSection.jsx'

export default function App() {
  const [introSeen, setIntroSeen] = useState(false)

  return (
    <>
      {/* A intro agora vive no fluxo do documento: é a altura dela que dá o
          curso de scroll. O site continua logo abaixo, normalmente. */}
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

        {/* WOW 01 — a capa desmonta e os cacos remontam a frase. Cena WebGL
            scrubada pelo scroll, entre a timeline e o player. */}
        <ShatterSection />

        {/* Capítulo 5 — Ouça o projeto. Primeira seção guiada pela mão
            (arrasto) em vez do scroll. */}
        <PlayerSection />

        {/* Capítulo 6 — os números, um por tela. */}
        <StatsSection />

        {/* Capítulo 7 — discografia: scroll vertical vira deslocamento horizontal. */}
        <DiscographySection />

        {/* Capítulo 8 — o mural de memória, arrastável. */}
        <GallerySection />

        {/* Capítulo 9 — os clipes, em fita de película. */}
        <ClipsSection />

        {/* Capítulo 10 — o palco acendendo. */}
        <ShowsSection />
      </main>
    </>
  )
}
