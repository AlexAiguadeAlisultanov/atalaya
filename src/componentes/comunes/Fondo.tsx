// Las capas de ambiente del HUD: rejilla blueprint, grano para matar el banding
// y una scanline muy tenue. Van fijas detrás de todo y no capturan el puntero.
// El color de fondo base lo pone el body en index.css.

export function Fondo() {
  return (
    <div className="fondo" aria-hidden="true">
      <div className="fondo-rejilla" />
      <svg className="fondo-grano" xmlns="http://www.w3.org/2000/svg">
        <filter id="grano-atalaya">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
        </filter>
        <rect width="100%" height="100%" filter="url(#grano-atalaya)" />
      </svg>
      <div className="fondo-scan" />
    </div>
  )
}
