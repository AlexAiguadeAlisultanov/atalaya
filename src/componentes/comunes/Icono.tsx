// Un único juego de iconos de línea, mismo grosor de trazo (1.6), dibujados a
// mano para no arrastrar una librería entera. Solo los que la interfaz usa.

import type { ReactNode } from 'react'

type Nombre = 'cerrar' | 'flecha-der' | 'flecha-izq' | 'descargar' | 'enlace' | 'escudo'

const TRAZOS: Record<Nombre, ReactNode> = {
  cerrar: <path d="M5 5l10 10M15 5L5 15" />,
  'flecha-der': <path d="M4 10h12M11 5l5 5-5 5" />,
  'flecha-izq': <path d="M16 10H4M9 5l-5 5 5 5" />,
  descargar: <path d="M10 3v9M6 9l4 4 4-4M4 16h12" />,
  enlace: <path d="M8 11a3 3 0 004 .3l2-2a3 3 0 00-4.2-4.2L11 6M12 9a3 3 0 00-4-.3l-2 2A3 3 0 0010 15l.8-.8" />,
  escudo: <path d="M10 3l6 2v4c0 4-3 6.5-6 8-3-1.5-6-4-6-8V5z" />,
}

export function Icono({ nombre, tam = 18 }: { nombre: Nombre; tam?: number }) {
  return (
    <svg
      className="icono"
      width={tam}
      height={tam}
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {TRAZOS[nombre]}
    </svg>
  )
}
