import './SiteFooter.css'

/** Rodape minimalista: fecha a pagina sem competir com o encerramento. */
export default function SiteFooter() {
  return (
    <footer className="evom-footer">
      <p className="evom-footer__mark">VEIGH</p>

      <p className="evom-footer__note">Eu Venci o Mundo &middot; 2025</p>

      <p className="evom-footer__by">
        Desenvolvido com
        {/* O coração é SVG e não emoji: emoji renderiza com a paleta do
            sistema operacional e sairia vermelho-padrão em vez do vinho. */}
        <svg className="evom-footer__heart" viewBox="0 0 24 24" aria-label="amor" role="img">
          <path
            fill="currentColor"
            d="M12 21s-7.5-4.7-9.6-9A5.6 5.6 0 0 1 12 6.3a5.6 5.6 0 0 1 9.6 5.7c-2.1 4.3-9.6 9-9.6 9z"
          />
        </svg>
        por{' '}
        <a href="https://caiodiniz.dev.br" target="_blank" rel="noopener noreferrer">
          Caio Diniz
        </a>
      </p>
    </footer>
  )
}
