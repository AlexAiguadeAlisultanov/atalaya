// Insignias reutilizables: la pill de severidad, el badge KEV (con su plazo de
// CISA) y la barra de puntuación de riesgo. Todas comparten la escala de color.

import type { Severidad } from '../../engine'
import { COLOR_SEVERIDAD, ETIQUETA_SEVERIDAD } from '../../lib/severidad'
import { fechaCorta } from '../../lib/formato'

export function PillSeveridad({ sev }: { sev: Severidad }) {
  const color = COLOR_SEVERIDAD[sev]
  return (
    <span
      className="pill"
      style={{ color, borderColor: `${color}55`, background: `${color}14` }}
    >
      {ETIQUETA_SEVERIDAD[sev]}
    </span>
  )
}

export function BadgeKev({ kev, plazo }: { kev: boolean; plazo?: string }) {
  if (!kev) {
    return <span className="kev kev-off">sin KEV</span>
  }
  return (
    <span className="kev" title={plazo ? `Plazo de remediación de CISA: ${fechaCorta(plazo)}` : undefined}>
      KEV{plazo ? ` · ${fechaCorta(plazo)}` : ''}
    </span>
  )
}

export function BarraRiesgo({ valor }: { valor: number }) {
  return (
    <span className="riesgo" aria-label={`Puntuación de riesgo ${valor} sobre 100`}>
      <span className="riesgo-barra">
        <span className="riesgo-relleno" style={{ width: `${valor}%` }} />
      </span>
      <b>{valor}</b>
    </span>
  )
}
