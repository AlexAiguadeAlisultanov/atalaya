// Entrada de la herramienta: elige un dominio de demostración o analiza el tuyo.
// El dominio propio exige consentimiento explícito y gasta uno de la cuota diaria;
// los de demostración vuelven al instante y no gastan nada.

import { useState } from 'react'
import type { FichaDominio } from '../../datos/sembrado'
import type { ErrorApi, Uso } from '../../lib/api'
import { Marco } from '../comunes/Marco'

export function Buscador({
  dominiosDemo,
  uso,
  cargando,
  error,
  onAnalizar,
}: {
  dominiosDemo: FichaDominio[]
  uso: Uso | null
  cargando: boolean
  error: ErrorApi | null
  onAnalizar: (dominio: string, consentimiento: boolean) => void
}) {
  const [propio, setPropio] = useState('')
  const [consentimiento, setConsentimiento] = useState(false)

  const sinCuota = uso ? uso.restante <= 0 : false
  const puedeEnviar = propio.trim().length > 0 && consentimiento && !cargando && !sinCuota

  const faltaConsentimiento = error?.codigo === 'consentimiento_requerido'

  return (
    <div className="buscador">
      <section className="bus-intro">
        <p className="eyebrow">Analiza una superficie</p>
        <h1 className="bus-titulo">¿Qué expones a internet?</h1>
        <p className="bus-sub">
          Empieza por un dominio de demostración para ver el resultado completo, o analiza el tuyo.
          En ambos casos es reconocimiento pasivo: ATALAYA consulta fuentes públicas y nunca toca el objetivo.
        </p>
      </section>

      {error && !faltaConsentimiento ? (
        <p className="bus-error" role="alert">{error.message}</p>
      ) : null}

      <section className="bus-demos">
        <h2 className="bus-apartado">Dominios de demostración</h2>
        <div className="bus-rejilla">
          {dominiosDemo.map((dom) => (
            <article key={dom.dominio} className="bus-carta panel-glass">
              <Marco />
              <span className="bus-sector mono">{dom.sector}</span>
              <h3 className="bus-nombre">{dom.nombre}</h3>
              <p className="bus-desc">{dom.descripcion}</p>
              <div className="bus-carta-pie">
                <span className="bus-dominio mono">{dom.dominio}</span>
                <button
                  type="button"
                  className="boton"
                  disabled={cargando}
                  onClick={() => onAnalizar(dom.dominio, false)}
                >
                  Analizar
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="bus-propio panel-glass">
        <Marco />
        <div className="bus-propio-cab">
          <h2 className="bus-apartado">Analizar mi propio dominio</h2>
          {uso ? (
            <span className={`bus-cuota mono ${sinCuota ? 'bus-cuota--agotada' : ''}`}>
              {uso.restante} de {uso.limite} análisis en vivo hoy
            </span>
          ) : null}
        </div>

        <form
          className="bus-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (puedeEnviar) onAnalizar(propio.trim(), consentimiento)
          }}
        >
          <div className="bus-campo">
            <input
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="empresa.es"
              value={propio}
              onChange={(e) => setPropio(e.target.value)}
              aria-label="Tu dominio"
              className="bus-input mono"
            />
            <button type="submit" className="boton" disabled={!puedeEnviar}>
              {cargando ? 'Analizando…' : 'Analizar en vivo'}
            </button>
          </div>

          <label className={`bus-consent ${faltaConsentimiento ? 'bus-consent--falta' : ''}`}>
            <input
              type="checkbox"
              checked={consentimiento}
              onChange={(e) => setConsentimiento(e.target.checked)}
            />
            <span>
              Confirmo que el dominio es mío o que tengo permiso para analizarlo. ATALAYA solo hace
              reconocimiento pasivo sobre fuentes públicas; no envía tráfico al objetivo. Cada análisis
              en vivo gasta uno de la cuota diaria.
            </span>
          </label>

          {faltaConsentimiento ? (
            <p className="bus-error" role="alert">{error?.message}</p>
          ) : null}
          {sinCuota ? (
            <p className="bus-error" role="alert">
              Has agotado los análisis en vivo de hoy. Los dominios de demostración siguen disponibles y no gastan cuota.
            </p>
          ) : null}
        </form>
      </section>
    </div>
  )
}
