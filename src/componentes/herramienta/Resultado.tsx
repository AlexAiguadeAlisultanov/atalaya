// Pantalla de resultado: el cockpit (nota + desglose + prioridades) y el mapa
// interactivo de la superficie. Todo sale de un único Analisis ya calculado.

import { useMemo, useState } from 'react'
import { construirGrafo } from '../../engine'
import type { Analisis, NodoGrafo } from '../../engine'
import { fechaCorta } from '../../lib/formato'
import { Gauge } from '../comunes/Gauge'
import { Marco } from '../comunes/Marco'
import { Icono } from '../comunes/Icono'
import { BadgeKev, PillSeveridad } from '../comunes/insignias'
import { GrafoInteractivo } from './GrafoInteractivo'
import { PanelActivo } from './PanelActivo'

export function Resultado({
  analisis,
  avisos,
  onVolver,
}: {
  analisis: Analisis
  avisos: string[]
  onVolver: () => void
}) {
  const { superficie, exposicion } = analisis
  const grafo = useMemo(() => construirGrafo(superficie), [superficie])
  const [seleccion, setSeleccion] = useState<NodoGrafo | null>(null)

  const d = exposicion.desglose
  const sembrado = superficie.modo === 'sembrado'

  const seleccionarCve = (ip: string, cve: string) => {
    const id = `cve:${ip}:${cve}`
    const n = grafo.nodos.find((x) => x.id === id)
    if (n) setSeleccion(n)
  }

  return (
    <div className="resultado">
      <div className="res-cabecera">
        <div className="res-ident">
          <span className="res-tipo mono">Superficie analizada</span>
          <h2 className="res-dominio">{superficie.dominio}</h2>
          <span className={`res-modo ${sembrado ? 'res-modo--demo' : 'res-modo--vivo'}`}>
            {sembrado
              ? `Instantánea de ejemplo · ${fechaCorta(superficie.generadoEn)}`
              : `Análisis en vivo · ${fechaCorta(superficie.generadoEn)}`}
          </span>
        </div>
        <div className="res-acciones no-imprimir">
          <button type="button" className="boton-sec" onClick={onVolver}>
            <Icono nombre="flecha-izq" tam={15} /> Analizar otro
          </button>
          <button type="button" className="boton" onClick={() => window.print()}>
            <Icono nombre="descargar" tam={15} /> Exportar informe
          </button>
        </div>
      </div>

      {sembrado ? (
        <p className="res-aviso-demo">
          Datos de demostración sobre rangos reservados a documentación (RFC 5737). Son una instantánea
          fija, no un sondeo en vivo. El cálculo de exposición es el mismo que se aplica a un dominio real.
        </p>
      ) : (
        <p className="res-fuentes mono">
          Respondieron: {superficie.fuentes.join(', ')}
        </p>
      )}

      {(superficie.parcial || avisos.length > 0) && (
        <div className="res-banner" role="status">
          <strong>El retrato puede estar incompleto.</strong>
          {superficie.parcial ? ' Alguna fuente no respondió a tiempo.' : ''}
          {avisos.length > 0 && (
            <ul>
              {avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
          )}
        </div>
      )}

      <section className="res-resumen panel-glass">
        <Marco />
        <div className="res-gauge">
          <Gauge
            valor={exposicion.score}
            nivel={exposicion.nivel}
            contexto={`${d.cvesKev} CVE en explotación activa sobre ${superficie.activos.length} activos`}
          />
        </div>
        <div className="res-desglose">
          <Metrica etiqueta="Servicios expuestos" valor={d.serviciosExpuestos} />
          <Metrica etiqueta="CVE en el catálogo KEV" valor={d.cvesKev} acento="crit" />
          <Metrica etiqueta="Certificados por caducar" valor={d.certificadosPorCaducar} acento="med" />
          <Metrica etiqueta="Puertos sensibles" valor={d.puertosSensibles} acento="high" />
        </div>
      </section>

      <div className="res-explora">
        <section className="res-mapa panel-glass">
          <Marco />
          <header className="res-sub">
            <span>Mapa de superficie</span>
            <span className="res-sub-hint no-imprimir">Pulsa un nodo</span>
          </header>
          <div className="res-mapa-lienzo">
            <GrafoInteractivo grafo={grafo} seleccion={seleccion?.id ?? null} onSeleccion={setSeleccion} />
          </div>
          {seleccion ? (
            <PanelActivo
              nodo={seleccion}
              superficie={superficie}
              exposicion={exposicion}
              onCerrar={() => setSeleccion(null)}
            />
          ) : null}
        </section>

        <section className="res-prioridades panel-glass">
          <Marco />
          <header className="res-sub">
            <span>Empieza por aquí</span>
            <span className="res-sub-hint">{exposicion.top.length} hallazgos priorizados</span>
          </header>
          {exposicion.top.length > 0 ? (
            <ol className="res-lista">
              {exposicion.top.map((h, i) => (
                <li key={h.cve + h.ip}>
                  <button type="button" className="res-hallazgo" onClick={() => seleccionarCve(h.ip, h.cve)}>
                    <span className="res-rank">{i + 1}</span>
                    <span className="res-h-datos">
                      <span className="res-h-cve mono">{h.cve}</span>
                      <span className="res-h-host mono">{h.host} · {h.servicio}</span>
                      <span className="res-h-razones">{h.razones.join(' · ')}</span>
                    </span>
                    <span className="res-h-estado">
                      <PillSeveridad sev={h.severidad} />
                      <BadgeKev kev={h.kev} plazo={h.kevPlazo} />
                      <span className="res-h-riesgo mono">riesgo {h.puntuacionRiesgo}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <div className="res-vacio">
              <Icono nombre="escudo" tam={26} />
              <p className="res-vacio-titulo">Sin vulnerabilidades conocidas en fuentes públicas</p>
              <p className="res-vacio-texto">
                Se mapearon {superficie.subdominios.length} subdominios y {d.serviciosExpuestos} servicios
                expuestos, pero ninguno arrastra CVE conocidas en las fuentes consultadas. Revisa igualmente
                el mapa: la superficie expuesta sigue siendo lo que un atacante ve primero.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function Metrica({ etiqueta, valor, acento }: { etiqueta: string; valor: number; acento?: 'crit' | 'high' | 'med' }) {
  const color = acento === 'crit' ? 'var(--crit)' : acento === 'high' ? 'var(--high)' : acento === 'med' ? 'var(--med)' : 'var(--ink)'
  return (
    <div className="res-metrica">
      <b style={{ color: valor > 0 && acento ? color : undefined }}>{valor}</b>
      <span>{etiqueta}</span>
    </div>
  )
}
