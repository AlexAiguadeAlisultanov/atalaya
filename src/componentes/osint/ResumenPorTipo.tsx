// Resumen de lo descubierto, agrupado por tipo de entidad. Es la versión en texto
// del grafo: todo queda en el DOM (accesible a lector de pantalla) y se puede leer
// sin depender del SVG. Cada fila selecciona su nodo en el grafo. Las brechas van
// marcadas porque son lo que enciende la alarma.

import type { Entidad, TipoEntidad } from '../../engine/osint/tipos'
import { Icono } from '../comunes/Icono'
import {
  COLOR_CONFIANZA,
  COLOR_TIPO,
  ETIQUETA_CONFIANZA,
  ETIQUETA_TIPO_PLURAL,
  ORDEN_RESUMEN,
} from './paleta'

export function ResumenPorTipo({
  entidades,
  seleccion,
  onSeleccion,
}: {
  entidades: Entidad[]
  seleccion: string | null
  onSeleccion: (e: Entidad) => void
}) {
  const grupos = new Map<TipoEntidad, Entidad[]>()
  for (const e of entidades) {
    const lista = grupos.get(e.tipo) ?? []
    lista.push(e)
    grupos.set(e.tipo, lista)
  }
  const tiposPresentes = ORDEN_RESUMEN.filter((t) => grupos.has(t))

  return (
    <div className="og-resumen">
      {tiposPresentes.map((tipo) => {
        const lista = grupos.get(tipo)!
        const color = COLOR_TIPO[tipo]
        return (
          <section key={tipo} className="og-grupo" aria-label={ETIQUETA_TIPO_PLURAL[tipo]}>
            <h4 className="og-grupo-cab">
              <span className="og-grupo-punto" style={{ background: color }} />
              {ETIQUETA_TIPO_PLURAL[tipo]}
              <span className="og-grupo-n">{lista.length}</span>
            </h4>
            <ul className="og-grupo-lista">
              {lista.map((e) => {
                const url = e.meta.url
                const esEnlace = e.tipo === 'cuenta' && typeof url === 'string' && /^https?:\/\//.test(url)
                const activa = seleccion === e.id
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      className={`og-item${activa ? ' og-item--activa' : ''}`}
                      onClick={() => onSeleccion(e)}
                      aria-pressed={activa}
                    >
                      <span className="og-item-etq">
                        {e.etiqueta}
                        {e.semilla ? <span className="og-item-semilla">semilla</span> : null}
                      </span>
                      <span className="og-item-meta">
                        {e.fuentes.length > 0 ? (
                          <span className="og-item-fuentes mono">{e.fuentes.join(', ')}</span>
                        ) : null}
                        <span
                          className="og-item-conf"
                          title={ETIQUETA_CONFIANZA[e.confianza]}
                          style={{ color: COLOR_CONFIANZA[e.confianza] }}
                        >
                          {e.confianza}
                        </span>
                        {esEnlace ? <Icono nombre="enlace" tam={13} /> : null}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
