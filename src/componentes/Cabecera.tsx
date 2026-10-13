// Cabecera fija. La marca, una navegación opcional que lleva a cada tramo de la
// portada, y una sola acción primaria. Se reutiliza en la portada y, con la
// marca como vuelta a casa, dentro de la herramienta.

interface Enlace {
  texto: string
  alPulsar: () => void
}

export function Cabecera({
  onAccion,
  textoAccion,
  onMarca,
  enlaces,
}: {
  onAccion: () => void
  textoAccion: string
  onMarca?: () => void
  enlaces?: Enlace[]
}) {
  return (
    <header className="cabecera">
      {onMarca ? (
        <button type="button" className="marca marca-boton" onClick={onMarca}>
          <span className="marca-punto" />
          ATA<b>LAYA</b>
        </button>
      ) : (
        <div className="marca">
          <span className="marca-punto" />
          ATA<b>LAYA</b>
        </div>
      )}

      {enlaces && enlaces.length > 0 ? (
        <nav className="cabecera-nav">
          {enlaces.map((e) => (
            <button type="button" key={e.texto} onClick={e.alPulsar}>
              {e.texto}
            </button>
          ))}
        </nav>
      ) : (
        <span />
      )}

      <button type="button" className="cta" onClick={onAccion}>
        {textoAccion}
      </button>
    </header>
  )
}
