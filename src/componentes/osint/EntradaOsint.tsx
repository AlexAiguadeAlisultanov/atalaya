// Entrada del apartado OSINT: el usuario añade varias semillas (email, usuario,
// dominio o IP), confirma que tiene autorización y lanza la investigación. El caso
// de demostración vuelve al instante y no gasta cuota; una investigación en vivo
// gasta una del día. La validación de cada fila es la misma que aplica el motor.

import { useId, useState } from 'react'
import type { CasoDemoOsint } from '../../datos/osint-sembrado'
import type { TipoEntidad } from '../../engine/osint/tipos'
import { semillaValida } from '../../engine/osint/normalizar'
import type { ErrorOsint, SemillaOsint, UsoOsint } from '../../lib/osintApi'
import { Marco } from '../comunes/Marco'
import { Icono } from '../comunes/Icono'
import { ETIQUETA_TIPO } from './paleta'

const TIPOS: TipoEntidad[] = ['email', 'usuario', 'dominio', 'ip']
const EJEMPLO: Record<TipoEntidad, string> = {
  email: 'nombre@empresa.es',
  usuario: 'nombre.apellido',
  dominio: 'empresa.es',
  ip: '203.0.113.33',
  cuenta: '',
  brecha: '',
  persona: '',
  organizacion: '',
  telefono: '',
}

interface Fila {
  id: number
  tipo: TipoEntidad
  valor: string
}

let contador = 0
const nuevaFila = (tipo: TipoEntidad = 'email'): Fila => ({ id: contador++, tipo, valor: '' })

export function EntradaOsint({
  casos,
  uso,
  cargando,
  error,
  onInvestigar,
  onCargarDemo,
}: {
  casos: CasoDemoOsint[]
  uso: UsoOsint | null
  cargando: boolean
  error: ErrorOsint | null
  onInvestigar: (semillas: SemillaOsint[], consentimiento: boolean) => void
  onCargarDemo: (caso: CasoDemoOsint) => void
}) {
  const [filas, setFilas] = useState<Fila[]>(() => [nuevaFila('email')])
  const [consentimiento, setConsentimiento] = useState(false)
  const consentId = useId()

  const validas = filas.filter((f) => f.valor.trim() !== '' && semillaValida(f.tipo, f.valor))
  const sinCuota = uso ? uso.restante <= 0 : false
  const puedeEnviar = validas.length > 0 && consentimiento && !cargando && !sinCuota
  const faltaConsentimiento = error?.codigo === 'consentimiento_requerido'

  const cambiar = (id: number, campo: 'tipo' | 'valor', valor: string) =>
    setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)))
  const añadir = () => setFilas((fs) => (fs.length >= 5 ? fs : [...fs, nuevaFila()]))
  const quitar = (id: number) => setFilas((fs) => (fs.length <= 1 ? fs : fs.filter((f) => f.id !== id)))

  const enviar = () => {
    if (!puedeEnviar) return
    onInvestigar(
      validas.map((f) => ({ tipo: f.tipo, valor: f.valor.trim() })),
      consentimiento,
    )
  }

  return (
    <div className="osint-entrada">
      <section className="bus-intro">
        <p className="eyebrow">Investigación OSINT</p>
        <h1 className="bus-titulo">Tira del hilo de un dato</h1>
        <p className="bus-sub">
          Parte de un email, un usuario, un dominio o una IP y ATALAYA sigue el rastro por fuentes públicas
          hasta dibujar en un grafo todo lo que cuelga: nombre, cuentas, filtraciones, proveedores e
          infraestructura.
        </p>
      </section>

      {casos.length > 0 ? (
        <section className="osint-demos">
          <h2 className="bus-apartado">Caso de demostración</h2>
          <div className="bus-rejilla">
            {casos.map((c) => (
              <article key={`${c.semilla.tipo}:${c.semilla.valor}`} className="bus-carta panel-glass">
                <Marco />
                <span className="bus-sector mono">{ETIQUETA_TIPO[c.semilla.tipo]} de ejemplo</span>
                <h3 className="bus-nombre">{c.titulo}</h3>
                <p className="bus-desc">{c.descripcion}</p>
                <div className="bus-carta-pie">
                  <span className="bus-dominio mono">{c.semilla.valor}</span>
                  <button type="button" className="boton" disabled={cargando} onClick={() => onCargarDemo(c)}>
                    Cargar caso
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className="bus-propio panel-glass">
        <Marco />
        <div className="bus-propio-cab">
          <h2 className="bus-apartado">Investigar mis datos</h2>
          {uso ? (
            <span className={`bus-cuota mono ${sinCuota ? 'bus-cuota--agotada' : ''}`}>
              {uso.restante} de {uso.limite} investigaciones en vivo hoy
            </span>
          ) : null}
        </div>

        <form
          className="osint-form"
          onSubmit={(e) => {
            e.preventDefault()
            enviar()
          }}
        >
          <div className="osint-filas">
            {filas.map((f) => {
              const invalida = f.valor.trim() !== '' && !semillaValida(f.tipo, f.valor)
              return (
                <div key={f.id} className="osint-fila">
                  <label className="osint-tipo">
                    <span className="sr-only">Tipo de dato</span>
                    <select
                      value={f.tipo}
                      onChange={(e) => cambiar(f.id, 'tipo', e.target.value)}
                      aria-label="Tipo de dato"
                    >
                      {TIPOS.map((t) => (
                        <option key={t} value={t}>
                          {ETIQUETA_TIPO[t]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <input
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={EJEMPLO[f.tipo]}
                    value={f.valor}
                    onChange={(e) => cambiar(f.id, 'valor', e.target.value)}
                    aria-label={`Valor del ${ETIQUETA_TIPO[f.tipo].toLowerCase()}`}
                    aria-invalid={invalida}
                    className={`bus-input mono osint-valor${invalida ? ' osint-valor--mal' : ''}`}
                  />
                  <button
                    type="button"
                    className="osint-quitar"
                    onClick={() => quitar(f.id)}
                    disabled={filas.length <= 1}
                    aria-label="Quitar esta fila"
                  >
                    <Icono nombre="cerrar" tam={15} />
                  </button>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            className="osint-anadir"
            onClick={añadir}
            disabled={filas.length >= 5}
          >
            + Añadir otro dato{filas.length >= 5 ? ' (máximo 5)' : ''}
          </button>

          <label className={`bus-consent ${faltaConsentimiento ? 'bus-consent--falta' : ''}`} htmlFor={consentId}>
            <input
              id={consentId}
              type="checkbox"
              checked={consentimiento}
              onChange={(e) => setConsentimiento(e.target.checked)}
            />
            <span>
              OSINT solo consulta fuentes públicas y pasivas. Confirmo que tengo autorización para investigar
              estos datos. Cada investigación en vivo gasta una de la cuota diaria.
            </span>
          </label>

          <div className="osint-form-pie">
            <button type="submit" className="boton" disabled={!puedeEnviar}>
              {cargando ? 'Investigando…' : 'Investigar'}
            </button>
          </div>

          {error && !faltaConsentimiento ? (
            <p className="bus-error" role="alert">
              {error.message}
            </p>
          ) : null}
          {faltaConsentimiento ? (
            <p className="bus-error" role="alert">
              {error?.message}
            </p>
          ) : null}
          {sinCuota ? (
            <p className="bus-error" role="alert">
              Has gastado las investigaciones en vivo de hoy. El caso de demostración sigue disponible y no gasta cuota.
            </p>
          ) : null}
        </form>
      </section>
    </div>
  )
}
