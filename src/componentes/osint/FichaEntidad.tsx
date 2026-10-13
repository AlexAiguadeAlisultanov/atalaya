// Ficha lateral de una entidad del grafo OSINT. Muestra lo que el motor ya dejó
// en la entidad: tipo, valor, confianza, de qué fuentes salió y su meta
// (ubicación, fechas, puertos, url de la cuenta...). Si es una cuenta con enlace,
// lo enlaza. No recalcula nada. Reutiliza las clases de ficha del mapa de
// superficie para que las dos se sientan la misma pieza.

import type { Entidad } from '../../engine/osint/tipos'
import { Marco } from '../comunes/Marco'
import { Icono } from '../comunes/Icono'
import {
  COLOR_CONFIANZA,
  COLOR_TIPO,
  ETIQUETA_CONFIANZA,
  ETIQUETA_TIPO,
  rotuloMeta,
  valorMeta,
} from './paleta'

export function FichaEntidad({ entidad, onCerrar }: { entidad: Entidad; onCerrar: () => void }) {
  const color = COLOR_TIPO[entidad.tipo]
  const url = entidad.meta.url
  const esEnlace = entidad.tipo === 'cuenta' && typeof url === 'string' && /^https?:\/\//.test(url)

  // El resto de meta se pinta en crudo con rótulos legibles, menos lo ya mostrado.
  const metaExtra = Object.entries(entidad.meta).filter(([clave]) => clave !== 'url')

  return (
    <aside className="pa panel-glass" aria-label={`Ficha de ${entidad.etiqueta}`}>
      <Marco />
      <div className="pa-cab">
        <div>
          <span className="pa-tipo" style={{ color }}>
            {ETIQUETA_TIPO[entidad.tipo]}
            {entidad.semilla ? ' · semilla' : ''}
          </span>
          <h3 className="pa-titulo">{entidad.etiqueta}</h3>
        </div>
        <button type="button" className="pa-cerrar" onClick={onCerrar} aria-label="Cerrar ficha">
          <Icono nombre="cerrar" tam={16} />
        </button>
      </div>

      <div className="pa-cuerpo">
        <div className="pa-campo">
          <span>Valor</span>
          <div className="mono" style={{ wordBreak: 'break-all' }}>
            {entidad.valor}
          </div>
        </div>

        <div className="pa-campo">
          <span>Confianza</span>
          <div>
            <span className="og-confianza">
              <i style={{ background: COLOR_CONFIANZA[entidad.confianza] }} />
              {ETIQUETA_CONFIANZA[entidad.confianza]}
            </span>
          </div>
        </div>

        {entidad.fuentes.length > 0 ? (
          <div className="pa-campo">
            <span>Visto en</span>
            <div className="og-fuentes">
              {entidad.fuentes.map((f) => (
                <span key={f} className="og-fuente">
                  {f}
                </span>
              ))}
            </div>
          </div>
        ) : entidad.semilla ? (
          <div className="pa-campo">
            <span>Origen</span>
            <div className="pa-dim">La semilla que investigaste</div>
          </div>
        ) : null}

        {esEnlace ? (
          <div className="pa-campo">
            <span>Perfil</span>
            <div>
              <a className="og-enlace" href={url} target="_blank" rel="noreferrer noopener">
                <Icono nombre="enlace" tam={14} />
                <span>{url.replace(/^https?:\/\//, '')}</span>
              </a>
            </div>
          </div>
        ) : null}

        {metaExtra.length > 0 ? (
          <div className="pa-campo">
            <span>Detalle</span>
            <dl className="og-meta">
              {metaExtra.map(([clave, valor]) => (
                <div key={clave} className="og-meta-fila">
                  <dt>{rotuloMeta(clave)}</dt>
                  <dd>{valorMeta(clave, valor)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </div>
    </aside>
  )
}
