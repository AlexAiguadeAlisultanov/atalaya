// Resultado del apartado OSINT: el grafo de entidades, la ficha del nodo elegido
// y el resumen por tipo (la versión en texto, siempre en el DOM). La cabecera
// distingue el modo de ejemplo del vivo y dice qué fuentes respondieron; un banner
// avisa si el retrato quedó incompleto. Todo sale de un único ResultadoOsint.

import { useMemo, useState } from 'react'
import { construirVistaOsint } from '../../engine/osint/disposicion'
import type { Entidad, ResultadoOsint as ResultadoOsintTipo, TipoEntidad } from '../../engine/osint/tipos'
import { fechaCorta } from '../../lib/formato'
import { Marco } from '../comunes/Marco'
import { Icono } from '../comunes/Icono'
import { COLOR_TIPO, ETIQUETA_TIPO } from './paleta'
import { OsintGrafo } from './OsintGrafo'
import { FichaEntidad } from './FichaEntidad'
import { ResumenPorTipo } from './ResumenPorTipo'

function cuenta(entidades: Entidad[], tipo: TipoEntidad): number {
  return entidades.filter((e) => e.tipo === tipo).length
}

export function ResultadoOsint({
  resultado,
  onVolver,
  onVerDossier,
}: {
  resultado: ResultadoOsintTipo
  onVolver: () => void
  onVerDossier: () => void
}) {
  const { grafo } = resultado
  const vista = useMemo(() => construirVistaOsint(grafo), [grafo])
  const porEntidad = useMemo(() => new Map(grafo.entidades.map((e) => [e.id, e])), [grafo])
  const [seleccion, setSeleccion] = useState<Entidad | null>(null)

  const sembrado = resultado.modo === 'sembrado'
  const semillaPrincipal = resultado.semillas[0]
  const nBrechas = cuenta(grafo.entidades, 'brecha')

  return (
    <div className="resultado osint-resultado">
      <div className="res-cabecera">
        <div className="res-ident">
          <span className="res-tipo mono">Mapa de entidades</span>
          <h2 className="res-dominio">
            {semillaPrincipal ? semillaPrincipal.valor : 'Investigación'}
            {resultado.semillas.length > 1 ? (
              <span className="osint-mas"> +{resultado.semillas.length - 1}</span>
            ) : null}
          </h2>
          <span className={`res-modo ${sembrado ? 'res-modo--demo' : 'res-modo--vivo'}`}>
            {sembrado
              ? `Datos de ejemplo · ${fechaCorta(resultado.generadoEn)}`
              : `En vivo · ${fechaCorta(resultado.generadoEn)}`}
          </span>
        </div>
        <div className="res-acciones no-imprimir">
          <button type="button" className="boton-sec" onClick={onVolver}>
            <Icono nombre="flecha-izq" tam={15} /> Investigar otro
          </button>
          <button type="button" className="boton" onClick={onVerDossier}>
            <Icono nombre="descargar" tam={15} /> Generar dossier
          </button>
        </div>
      </div>

      {resultado.semillas.length > 1 ? (
        <div className="osint-semillas" aria-label="Datos investigados">
          {resultado.semillas.map((s) => (
            <span key={`${s.tipo}:${s.valor}`} className="osint-semilla">
              <span className="osint-semilla-tipo mono">{ETIQUETA_TIPO[s.tipo]}</span>
              {s.valor}
            </span>
          ))}
        </div>
      ) : null}

      {sembrado ? (
        <p className="res-aviso-demo">
          Persona y organización ficticias, con IPs de los rangos reservados a documentación (RFC 5737). Es una
          instantánea fija, no una consulta en vivo, pero el pivoteo es el mismo que se aplica a datos reales.
        </p>
      ) : resultado.fuentes.length > 0 ? (
        <p className="res-fuentes mono">Respondieron: {resultado.fuentes.join(', ')}</p>
      ) : null}

      {(resultado.parcial || resultado.avisos.length > 0) && (
        <div className="res-banner" role="status">
          <strong>El retrato puede estar incompleto.</strong>
          {resultado.parcial ? ' Alguna fuente no respondió a tiempo.' : ''}
          {resultado.avisos.length > 0 && (
            <ul>
              {resultado.avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section className="osint-cifras panel-glass">
        <Marco />
        <Cifra etiqueta="Entidades" valor={grafo.entidades.length} />
        <Cifra etiqueta="Cuentas" valor={cuenta(grafo.entidades, 'cuenta')} tipo="cuenta" />
        <Cifra etiqueta="Brechas" valor={nBrechas} tipo="brecha" resaltar={nBrechas > 0} />
        <Cifra etiqueta="Dominios" valor={cuenta(grafo.entidades, 'dominio')} tipo="dominio" />
        <Cifra etiqueta="Organizaciones" valor={cuenta(grafo.entidades, 'organizacion')} tipo="organizacion" />
        <Cifra etiqueta="IPs" valor={cuenta(grafo.entidades, 'ip')} tipo="ip" />
      </section>

      <div className="res-explora osint-explora">
        <section className="res-mapa panel-glass">
          <Marco />
          <header className="res-sub">
            <span>Grafo de entidades</span>
            <span className="res-sub-hint no-imprimir">Pulsa un nodo</span>
          </header>
          <div className="res-mapa-lienzo osint-lienzo">
            <OsintGrafo
              vista={vista}
              entidades={porEntidad}
              seleccion={seleccion?.id ?? null}
              onSeleccion={setSeleccion}
            />
          </div>
          {seleccion ? <FichaEntidad entidad={seleccion} onCerrar={() => setSeleccion(null)} /> : null}
        </section>

        <section className="res-prioridades panel-glass">
          <Marco />
          <header className="res-sub">
            <span>Lo descubierto</span>
            <span className="res-sub-hint">{grafo.entidades.length} entidades</span>
          </header>
          <div className="osint-resumen-caja">
            <ResumenPorTipo
              entidades={grafo.entidades}
              seleccion={seleccion?.id ?? null}
              onSeleccion={setSeleccion}
            />
          </div>
        </section>
      </div>
    </div>
  )
}

function Cifra({
  etiqueta,
  valor,
  tipo,
  resaltar,
}: {
  etiqueta: string
  valor: number
  tipo?: TipoEntidad
  resaltar?: boolean
}) {
  const color = tipo && (resaltar || (tipo !== 'brecha' && valor > 0)) ? COLOR_TIPO[tipo] : undefined
  return (
    <div className="osint-cifra">
      <b style={{ color }}>{valor}</b>
      <span>{etiqueta}</span>
    </div>
  )
}
