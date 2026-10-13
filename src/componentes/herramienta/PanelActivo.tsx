// Panel lateral que abre la ficha de un nodo del grafo. Resuelve el nodo contra
// la superficie y la exposición ya calculadas; no recalcula nada.

import type { ReactNode } from 'react'
import type { Exposicion, NodoGrafo, SuperficieAtaque } from '../../engine'
import { ETIQUETA_NIVEL } from '../../lib/severidad'
import { certificadoTexto, cvssTexto, fechaCorta, porcentajeEpss } from '../../lib/formato'
import { Marco } from '../comunes/Marco'
import { Icono } from '../comunes/Icono'
import { BadgeKev, BarraRiesgo, PillSeveridad } from '../comunes/insignias'

const ROTULO_TIPO: Record<NodoGrafo['tipo'], string> = {
  dominio: 'Dominio',
  subdominio: 'Subdominio',
  activo: 'Activo',
  servicio: 'Servicio',
  cve: 'Vulnerabilidad',
}

function Campo({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <div className="pa-campo">
      <span>{etiqueta}</span>
      <div>{children}</div>
    </div>
  )
}

export function PanelActivo({
  nodo,
  superficie,
  exposicion,
  onCerrar,
}: {
  nodo: NodoGrafo
  superficie: SuperficieAtaque
  exposicion: Exposicion
  onCerrar: () => void
}) {
  return (
    <aside className="pa panel-glass" aria-label={`Ficha de ${nodo.etiqueta}`}>
      <Marco />
      <div className="pa-cab">
        <div>
          <span className="pa-tipo">{ROTULO_TIPO[nodo.tipo]}</span>
          <h3 className="pa-titulo">{nodo.etiqueta}</h3>
        </div>
        <button type="button" className="pa-cerrar" onClick={onCerrar} aria-label="Cerrar ficha">
          <Icono nombre="cerrar" tam={16} />
        </button>
      </div>
      <div className="pa-cuerpo">{cuerpo(nodo, superficie, exposicion)}</div>
    </aside>
  )
}

function cuerpo(nodo: NodoGrafo, superficie: SuperficieAtaque, exposicion: Exposicion) {
  if (nodo.tipo === 'dominio') {
    const d = exposicion.desglose
    return (
      <>
        <Campo etiqueta="Nota de exposición">
          <b className="pa-num">{exposicion.score}</b> / 100 · {ETIQUETA_NIVEL[exposicion.nivel]}
        </Campo>
        <Campo etiqueta="Inventario">
          {superficie.subdominios.length} subdominios · {superficie.activos.length} activos · {d.serviciosExpuestos} servicios
        </Campo>
        <Campo etiqueta="Lo que más pesa">
          {d.cvesTotal} CVE, {d.cvesKev} en el catálogo KEV · {d.puertosSensibles} puertos sensibles · {d.certificadosPorCaducar} certificados por caducar
        </Campo>
        <p className="pa-nota">Pulsa un nodo del mapa para ver el detalle de cada activo y de cada vulnerabilidad.</p>
      </>
    )
  }

  if (nodo.tipo === 'subdominio') {
    const nombreCompleto = `${nodo.etiqueta}.${superficie.dominio}`
    const sub = superficie.subdominios.find((s) => s.nombre === nombreCompleto || s.nombre === nodo.etiqueta)
    return (
      <>
        <Campo etiqueta="Nombre">{sub?.nombre ?? nombreCompleto}</Campo>
        <Campo etiqueta="Resuelve a">
          {(sub?.ips ?? []).length ? sub!.ips.map((ip) => <div key={ip} className="mono">{ip}</div>) : <span className="pa-dim">sin resolución</span>}
        </Campo>
        <Campo etiqueta="Visto en">{(sub?.origen ?? []).join(', ') || '—'}</Campo>
      </>
    )
  }

  if (nodo.tipo === 'activo') {
    const ip = nodo.etiqueta
    const activo = superficie.activos.find((a) => a.ip === ip)
    const hallazgos = exposicion.top.filter((h) => h.ip === ip)
    if (!activo) return <p className="pa-dim">Sin datos de este activo.</p>
    return (
      <>
        <Campo etiqueta="Hosts">{activo.hosts.join(', ')}</Campo>
        <Campo etiqueta="Origen">
          {activo.organizacion ?? '—'}{activo.pais ? ` · ${activo.pais}` : ''}
        </Campo>
        {activo.certificadoCaducaEnDias !== undefined ? (
          <Campo etiqueta="Certificado TLS">
            <span className={activo.certificadoCaducaEnDias <= 30 ? 'pa-alerta' : ''}>
              {certificadoTexto(activo.certificadoCaducaEnDias)}
            </span>
          </Campo>
        ) : null}
        <Campo etiqueta="Servicios expuestos">
          <div className="pa-servicios">
            {activo.servicios.map((s) => (
              <div key={`${s.nombre}:${s.puerto}`} className="pa-servicio">
                <span className="mono">{s.nombre}:{s.puerto}</span>
                <span className="pa-dim">{[s.producto, s.version].filter(Boolean).join(' ') || 'sin huella de versión'}</span>
              </div>
            ))}
          </div>
        </Campo>
        {hallazgos.length ? (
          <Campo etiqueta="Vulnerabilidades">
            <div className="pa-cves">
              {hallazgos.map((h) => (
                <div key={h.cve} className="pa-cve-fila">
                  <span className="mono">{h.cve}</span>
                  <PillSeveridad sev={h.severidad} />
                  <BadgeKev kev={h.kev} plazo={h.kevPlazo} />
                </div>
              ))}
            </div>
          </Campo>
        ) : null}
      </>
    )
  }

  // CVE
  const partes = nodo.id.split(':')
  const ip = partes[1] ?? ''
  const cveId = partes.slice(2).join(':') || nodo.etiqueta
  const hallazgo = exposicion.top.find((h) => h.ip === ip && h.cve === cveId)
  let descripcion: string | undefined
  const activo = superficie.activos.find((a) => a.ip === ip)
  if (activo) {
    for (const s of activo.servicios) {
      const coincidencia = s.cves.find((cve) => cve.id === cveId)
      if (coincidencia) descripcion = coincidencia.descripcion
    }
  }
  return (
    <>
      {descripcion ? <p className="pa-desc">{descripcion}</p> : null}
      {hallazgo ? (
        <>
          <Campo etiqueta="Dónde">
            <div className="mono">{hallazgo.host}</div>
            <div className="pa-dim mono">{ip} · {hallazgo.servicio}</div>
          </Campo>
          <div className="pa-metricas">
            <div><span>CVSS</span><b>{cvssTexto(hallazgo.cvss)}</b></div>
            <div><span>EPSS</span><b>{porcentajeEpss(hallazgo.epss)}</b></div>
            <div><span>Riesgo</span><b>{hallazgo.puntuacionRiesgo}</b></div>
          </div>
          <Campo etiqueta="Estado">
            <div className="pa-estado">
              <PillSeveridad sev={hallazgo.severidad} />
              <BadgeKev kev={hallazgo.kev} plazo={hallazgo.kevPlazo} />
            </div>
          </Campo>
          <BarraRiesgo valor={hallazgo.puntuacionRiesgo} />
          <Campo etiqueta="Por qué sube">
            <ul className="pa-razones">
              {hallazgo.razones.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </Campo>
          {hallazgo.kev && hallazgo.kevPlazo ? (
            <p className="pa-nota">CISA marcó como plazo de remediación el {fechaCorta(hallazgo.kevPlazo)}.</p>
          ) : null}
        </>
      ) : (
        <p className="pa-dim">Sin datos de prioridad para esta vulnerabilidad.</p>
      )}
    </>
  )
}
