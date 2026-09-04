import './GrainLayer.css'

/** Grão de filme + vinheta sobre a experiência inteira. Duas divs, sem JS. */
export default function GrainLayer() {
  return (
    <>
      <div className="evom-grain" aria-hidden="true" />
      <div className="evom-vignette" aria-hidden="true" />
    </>
  )
}
