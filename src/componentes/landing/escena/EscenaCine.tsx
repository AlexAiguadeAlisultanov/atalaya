// La capa cinematográfica de la portada: un canvas fijo a pantalla completa con
// la escena, más las capas de post (viñeteado, scanlines, grano, aberración)
// que van en el DOM porque son más baratas ahí.
//
// Un único requestAnimationFrame lee la posición de scroll, la suaviza (para
// ese arrastre de cinta de vídeo) y pinta. Cada fotograma avisa del progreso ya
// suavizado a quien monta el HUD, para que las cifras y los textos vayan al
// compás de la imagen. En modo sin movimiento pinta un solo fotograma rico.

import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { crearMotor } from './motorEscena'

interface Props {
  scrollerRef: RefObject<HTMLElement | null>
  estatico: boolean
  movil: boolean
  nAmenazas: number
  onProgreso: (p: number) => void
  progresoEstatico: number
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}

export function EscenaCine({ scrollerRef, estatico, movil, nAmenazas, onProgreso, progresoEstatico }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    const motor = crearMotor(ctx, {
      acento: '#7C5CFF',
      acento2: '#9B82FF',
      critico: '#FF2D55',
      alto: '#FF6B35',
      nAmenazas,
      movil,
    })

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

    // Sin movimiento: un fotograma fijo con la escena ya montada y las cifras al
    // final. Nada de bucle ni de scroll.
    if (estatico) {
      motor.dibujar(progresoEstatico, 0)
      onProgreso(1)
      const alRedimensionar = () => {
        dimensionar()
        motor.dibujar(progresoEstatico, 0)
      }
      window.addEventListener('resize', alRedimensionar)
      return () => window.removeEventListener('resize', alRedimensionar)
    }

    const leerObjetivo = (): number => {
      const sc = scrollerRef.current
      if (!sc) return 0
      const rect = sc.getBoundingClientRect()
      const recorrido = sc.offsetHeight - window.innerHeight
      return recorrido > 0 ? clamp01(-rect.top / recorrido) : 0
    }

    let raf = 0
    let anterior = performance.now()
    const t0 = anterior
    let u = leerObjetivo()
    let activo = true

    const bucle = (ahora: number) => {
      const dt = Math.min(0.064, (ahora - anterior) / 1000)
      anterior = ahora
      const objetivo = leerObjetivo()
      const k = 1 - Math.exp(-dt * 6)
      u = Math.abs(objetivo - u) < 0.0004 ? objetivo : u + (objetivo - u) * k
      const tiempo = (ahora - t0) / 1000
      motor.dibujar(u, tiempo)
      onProgreso(u)
      if (activo) raf = requestAnimationFrame(bucle)
    }
    raf = requestAnimationFrame(bucle)

    // Pausa cuando la pestaña no se ve, para no gastar batería de balde.
    const alVisibilidad = () => {
      if (document.hidden) {
        activo = false
        cancelAnimationFrame(raf)
      } else if (!activo) {
        activo = true
        anterior = performance.now()
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
  }, [scrollerRef, estatico, movil, nAmenazas, progresoEstatico, onProgreso])

  return (
    <>
      <canvas ref={canvasRef} className="l-cine" aria-hidden="true" />
      <div className="l-fx" aria-hidden="true">
        <div className="l-fx-crom" />
        <div className="l-fx-scan" />
        <div className="l-fx-grano" />
        <div className="l-fx-vig" />
      </div>
    </>
  )
}
