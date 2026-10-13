// El efecto de "alguien tecleando" un dominio en la terminal de la portada.
// Escribe letra a letra, espera, borra y repite. Si el sistema pide menos
// movimiento, muestra el texto entero de una vez.

import { useEffect, useState } from 'react'

export function useTecleo(texto: string, activo: boolean): string {
  const [visible, setVisible] = useState(activo ? '' : texto)

  useEffect(() => {
    if (!activo) {
      setVisible(texto)
      return
    }
    let i = 0
    let temporizador = 0
    const tick = () => {
      if (i <= texto.length) {
        setVisible(texto.slice(0, i))
        i += 1
        temporizador = window.setTimeout(tick, 115)
      } else {
        temporizador = window.setTimeout(() => {
          i = 0
          setVisible('')
          tick()
        }, 2600)
      }
    }
    tick()
    return () => window.clearTimeout(temporizador)
  }, [texto, activo])

  return visible
}
