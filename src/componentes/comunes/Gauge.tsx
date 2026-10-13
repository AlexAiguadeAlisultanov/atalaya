// Gauge radial de exposición 0..100. Mismo radio y grosor que el de la portada
// para que el número que ve el usuario al final del scroll sea el mismo que
// encuentra luego en la herramienta. Cuenta hasta el valor al montar, salvo que
// el sistema pida menos movimiento.

import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { NivelExposicion } from '../../engine'
import { COLOR_NIVEL, ETIQUETA_NIVEL } from '../../lib/severidad'

const RADIO = 92
const CIRC = 2 * Math.PI * RADIO // ~578

function prefiereMenosMovimiento(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export function Gauge({
  valor,
  nivel,
  contexto,
}: {
  valor: number
  nivel: NivelExposicion
  contexto?: string
}) {
  const [mostrado, setMostrado] = useState(() => (prefiereMenosMovimiento() ? valor : 0))
  const rafRef = useRef(0)

  useEffect(() => {
    if (prefiereMenosMovimiento()) {
      setMostrado(valor)
      return
    }
    const inicio = performance.now()
    const dur = 900
    const paso = (ahora: number) => {
      const t = Math.min(1, (ahora - inicio) / dur)
      // easing suave de salida
      const e = 1 - Math.pow(1 - t, 3)
      setMostrado(Math.round(valor * e))
      if (t < 1) rafRef.current = requestAnimationFrame(paso)
    }
    rafRef.current = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(rafRef.current)
  }, [valor])

  const color = COLOR_NIVEL[nivel]
  const offset = CIRC * (1 - mostrado / 100)

  return (
    <div className="gauge" style={{ '--nivel': color } as CSSProperties}>
      <svg width="220" height="220" viewBox="0 0 220 220" role="img"
        aria-label={`Exposición ${valor} sobre 100, nivel ${ETIQUETA_NIVEL[nivel].toLowerCase()}`}>
        <circle cx="110" cy="110" r={RADIO} fill="none" stroke="#1b2436" strokeWidth="14" />
        <circle
          cx="110"
          cy="110"
          r={RADIO}
          fill="none"
          stroke={color}
          strokeWidth="14"
          strokeLinecap="round"
          transform="rotate(-90 110 110)"
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
        />
        <text x="110" y="118" textAnchor="middle" className="gauge-num" fill={color}
          style={{ filter: `drop-shadow(0 0 18px ${color}66)` }}>
          {mostrado}
        </text>
        <text x="110" y="150" textAnchor="middle" className="gauge-sub">
          / 100 · {ETIQUETA_NIVEL[nivel].toUpperCase()}
        </text>
      </svg>
      {contexto ? <div className="gauge-ctx">{contexto}</div> : null}
    </div>
  )
}
