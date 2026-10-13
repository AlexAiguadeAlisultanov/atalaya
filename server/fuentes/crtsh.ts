// crt.sh — transparencia de certificados. Cada certificado HTTPS emitido queda en
// un registro público; buscando el dominio salen subdominios que ni se sabían.
// Fuente pasiva pura: no tocamos el objetivo, preguntamos a un tercero.

import { conCache } from '../cache'
import { obtenerJson } from '../http'

interface FilaCrtsh {
  name_value?: string
  common_name?: string
}

const TTL = 24 * 3600

export async function subdominiosDeCrtsh(dominio: string, limite = 60): Promise<string[]> {
  const clave = `crtsh:${dominio}`
  return conCache(clave, TTL, async () => {
    const url = `https://crt.sh/?q=%25.${encodeURIComponent(dominio)}&output=json`
    // Timeout ajustado: crt.sh es lento y a veces cae, pero hackertarget corre en
    // paralelo y lo cubre, así que no conviene esperarlo de más ni reintentar.
    const filas = await obtenerJson<FilaCrtsh[]>('crtsh', url, { timeoutMs: 12000 })
    const set = new Set<string>()
    for (const fila of filas) {
      const campos = [fila.name_value, fila.common_name].filter(Boolean) as string[]
      for (const campo of campos) {
        for (const bruto of campo.split('\n')) {
          const nombre = bruto.trim().toLowerCase().replace(/^\*\./, '')
          if (!nombre) continue
          if (nombre === dominio || nombre.endsWith(`.${dominio}`)) set.add(nombre)
        }
      }
    }
    return [...set].sort().slice(0, limite)
  })
}
