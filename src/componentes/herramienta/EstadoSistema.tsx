// Estado del sistema: qué versión corre, qué backend de caché usa, cuánta cuota
// queda hoy y qué fuentes pasivas tiene detrás. Va plegado en el pie para no
// robar atención, pero a un clic de distancia.

import type { Estado } from '../../lib/api'

export function EstadoSistema({ estado }: { estado: Estado | null }) {
  return (
    <details className="estado no-imprimir">
      <summary>
        <span className="estado-punto" data-ok={estado ? 'si' : 'no'} />
        Estado del sistema
        {estado ? <span className="estado-ver mono">v{estado.version} · caché {estado.base}</span> : null}
      </summary>

      {estado ? (
        <div className="estado-cuerpo">
          <div className="estado-cifras">
            <div><span>Límite diario</span><b>{estado.limiteDiario}</b></div>
            <div><span>Usados hoy</span><b>{estado.uso.usados}</b></div>
            <div><span>Restantes</span><b>{estado.uso.restante}</b></div>
            <div><span>Entradas en caché</span><b>{estado.entradasCache}</b></div>
          </div>

          <div className="estado-fuentes">
            <span className="estado-titulo mono">Fuentes pasivas</span>
            <ul>
              {estado.fuentes.map((f) => (
                <li key={f.id}>
                  <span className="estado-fuente-nombre">{f.nombre}</span>
                  <span className={`estado-clave ${f.clave ? 'estado-clave--si' : ''}`}>
                    {f.clave ? 'con clave' : 'sin clave'}
                  </span>
                </li>
              ))}
            </ul>
            {!estado.nvdConClave ? (
              <p className="estado-nota">
                NVD funciona sin clave, pero con una el límite de peticiones es más alto y los CVSS llegan más completos.
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="estado-cuerpo">
          <p className="estado-nota">No se pudo leer el estado. Comprueba que la API está levantada.</p>
        </div>
      )}
    </details>
  )
}
