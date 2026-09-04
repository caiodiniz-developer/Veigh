import { useEffect, useRef, useState } from 'react'
import './CursorLayer.css'

/**
 * Cursor vivo.
 *
 * O cursor nativo continua existindo — substituí-lo por completo quebra
 * affordance em links e campos. O que este componente faz é acrescentar um
 * anel que segue o ponteiro e muda de estado conforme o que está embaixo:
 * DRAG no carrossel, VIEW na galeria, WATCH no clipe, PLAY na música.
 *
 * O estado sai de um data-attribute nos elementos, não de uma lista de
 * seletores aqui — assim uma seção nova só precisa declarar o próprio rótulo.
 */
const ZONES = [
  { sel: '.evom-player__stage', label: 'arraste' },
  { sel: '.evom-player__card-glass', label: 'tocar' },
  { sel: '.evom-wall__surface', label: 'arraste' },
  { sel: '.evom-wall__shot', label: 'ver' },
  { sel: '.evom-clips__frame', label: 'assistir' },
  { sel: '.evom-disc__art', label: 'disco' },
]

export default function CursorLayer() {
  const dotRef = useRef(null)
  const [label, setLabel] = useState('')
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Ponteiro grosso (toque) não tem cursor para enfeitar.
    if (!window.matchMedia('(pointer: fine)').matches) return

    const dot = dotRef.current
    let raf = 0
    let tx = 0
    let ty = 0
    let x = 0
    let y = 0

    const move = (e) => {
      tx = e.clientX
      ty = e.clientY
      if (!visible) setVisible(true)

      const el = e.target instanceof Element ? e.target : null
      const zone = el ? ZONES.find((z) => el.closest(z.sel)) : null
      setLabel(zone ? zone.label : '')
    }

    // Interpolação própria em rAF: escrever o transform direto no mousemove
    // gruda o anel no ponteiro e mata a sensação de peso.
    const tick = () => {
      raf = requestAnimationFrame(tick)
      x += (tx - x) * 0.18
      y += (ty - y) * 0.18
      if (dot) dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`
    }

    window.addEventListener('pointermove', move, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('pointermove', move)
      cancelAnimationFrame(raf)
    }
  }, [visible])

  return (
    <div
      ref={dotRef}
      className={`evom-cursor${label ? ' has-label' : ''}${visible ? ' is-on' : ''}`}
      aria-hidden="true"
    >
      <span className="evom-cursor__ring" />
      <span className="evom-cursor__label">{label}</span>
    </div>
  )
}
