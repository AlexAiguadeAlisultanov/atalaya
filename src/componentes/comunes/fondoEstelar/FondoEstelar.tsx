// Fondo estrellado ambiente, fijo a pantalla completa y detrás del contenido.
// Lo usa la herramienta para que el campo de estrellas se vea por todas partes,
// también al bajar hasta el final. Es la versión calmada del fondo de la portada:
// deriva lenta, baja opacidad, sin rejilla ni scrub.
//
// Autónomo: decide él mismo si hay que reducir movimiento o si es móvil. En
// reduced-motion pinta un solo fotograma. Pausa con la pestaña oculta.

import { useEffect, useRef, useState } from 'react'
import { crearMotorAmbiente } from './motorAmbiente'

function prefiereMenosMovimiento(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function esMovil(): boolean {
  return window.matchMedia('(max-width: 760px)').matches
}

export function FondoEstelar() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [estatico] = useState(prefiereMenosMovimiento)
  const [movil] = useState(esMovil)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const motor = crearMotorAmbiente(ctx, { acento: '#7C5CFF', acento2: '#9B82FF', movil })

    let dpr = 1
    const dimensionar = () => {
      const w = window.innerWidth
      const h = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, movil ? 2 : 1.75)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = w + 'px'
      canvas.style.height = h + 'px'
      motor.redimensionar(w, h, dpr)
    }
    dimensionar()

    if (estatico) {
      motor.dibujar(0)
      const alRedimensionar = () => {
        dimensionar()
        motor.dibujar(0)
      }
      window.addEventListener('resize', alRedimensionar)
      return () => window.removeEventListener('resize', alRedimensionar)
    }

    let raf = 0
    const t0 = performance.now()
    let activo = true
    const bucle = (ahora: number) => {
      motor.dibujar((ahora - t0) / 1000)
      if (activo) raf = requestAnimationFrame(bucle)
    }
    raf = requestAnimationFrame(bucle)

    const alVisibilidad = () => {
      if (document.hidden) {
        activo = false
        cancelAnimationFrame(raf)
      } else if (!activo) {
        activo = true
        raf = requestAnimationFrame(bucle)
      }
    }
    window.addEventListener('resize', dimensionar)
    document.addEventListener('visibilitychange', alVisibilidad)

    return () => {
      activo = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', dimensionar)
      document.removeEventListener('visibilitychange', alVisibilidad)
    }
  }, [estatico, movil])

  return <canvas ref={canvasRef} className="fondo-estelar" aria-hidden="true" />
}
