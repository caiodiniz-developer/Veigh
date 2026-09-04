import { useEffect, useState } from 'react'
import { readMotionMode, setMotionMode, systemPrefersReduced, FULL, CALM } from '../motion.js'
import './MotionToggle.css'

/**
 * Alternador de modo de movimento.
 *
 * Existe porque a preferência do sistema não é sempre uma escolha consciente:
 * desligar "Efeitos de animação" no Windows por causa de desempenho já faz o
 * browser reportar `prefers-reduced-motion: reduce`, e a pessoa cai no modo
 * calmo sem nunca ter pedido. O controle deixa a escolha explícita — e a
 * escolha explícita vence a do sistema, nas duas direções.
 */
export default function MotionToggle() {
  const [mode, setMode] = useState(null)
  const [systemReduced, setSystemReduced] = useState(false)

  // Só depois da montagem: ler localStorage/matchMedia no primeiro render
  // faria o marcador piscar no modo errado.
  useEffect(() => {
    setMode(readMotionMode())
    setSystemReduced(systemPrefersReduced())
  }, [])

  if (!mode) return null

  const calm = mode === CALM
  const next = calm ? FULL : CALM

  return (
    <div className="evom-motion">
      <button
        type="button"
        className="evom-motion__btn"
        onClick={() => setMotionMode(next)}
        aria-pressed={!calm}
      >
        <span className={`evom-motion__dot${calm ? '' : ' is-live'}`} aria-hidden="true" />
        {calm ? 'Ativar animação completa' : 'Reduzir animação'}
      </button>

      {calm && systemReduced && (
        <p className="evom-motion__hint">
          Seu sistema está pedindo menos animação, então o site abriu no modo calmo.
        </p>
      )}
    </div>
  )
}
