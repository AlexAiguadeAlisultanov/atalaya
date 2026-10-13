// Un ÚNICO valor de progreso 0..1 para toda la animación de la portada. Se
// calcula del recorrido de la sección fijada (getBoundingClientRect) y se
// entrega a quien lo pida, limitado por rAF para no disparar trabajo en cada
// evento de scroll. Un solo listener, no N.

import { useEffect } from 'react'
import type { RefObject } from 'react'

function limitar01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

export function useProgresoScroll(
  scrollerRef: RefObject<HTMLElement | null>,
  alProgresar: (p: number) => void,
  activo: boolean,
) {
  useEffect(() => {
    if (!activo) return
    const scroller = scrollerRef.current
    if (!scroller) return

    let pendiente = false

    const medir = () => {
      pendiente = false
      const rect = scroller.getBoundingClientRect()
      const recorrido = scroller.offsetHeight - window.innerHeight
      const p = recorrido > 0 ? limitar01(-rect.top / recorrido) : 0
      alProgresar(p)
    }

    const enScroll = () => {
      if (pendiente) return
      pendiente = true
      requestAnimationFrame(medir)
    }

    medir()
    window.addEventListener('scroll', enScroll, { passive: true })
    window.addEventListener('resize', enScroll)
    return () => {
      window.removeEventListener('scroll', enScroll)
      window.removeEventListener('resize', enScroll)
    }
  }, [scrollerRef, alProgresar, activo])
}
