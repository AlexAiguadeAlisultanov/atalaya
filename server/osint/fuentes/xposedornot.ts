// XposedOrNot: de un email a las filtraciones de datos conocidas donde aparece.
// Gratis y sin clave. Igual que "Have I Been Pwned", pero con API abierta. Dato
// sensible: por eso el apartado OSINT exige consentimiento antes de consultar.

import { conCache } from '../../cache'
import { ErrorFuente, obtenerJson } from '../../http'

export interface Brecha {
  nombre: string
  dominio?: string
  fecha?: string
  registros?: string
  datos?: string
}

interface RespuestaXposed {
  ExposedBreaches?: {
    breaches_details?: Array<{
      breach?: string
      domain?: string
      xposed_date?: string
      xposed_records?: number
      xposed_data?: string
    }>
  }
}

const TTL = 12 * 3600

export async function brechasDeEmail(email: string): Promise<Brecha[]> {
  const clave = `xposed:${email.trim().toLowerCase()}`
  return conCache(clave, TTL, async () => {
    try {
      const d = await obtenerJson<RespuestaXposed>(
        'xposedornot',
        `https://api.xposedornot.com/v1/breach-analytics?email=${encodeURIComponent(email.trim())}`,
        { timeoutMs: 9000 },
      )
      const det = d.ExposedBreaches?.breaches_details ?? []
      return det
        .filter((b) => b.breach)
        .map((b) => ({
          nombre: b.breach!,
          dominio: b.domain || undefined,
          fecha: b.xposed_date ? String(b.xposed_date) : undefined,
          registros: b.xposed_records ? String(b.xposed_records) : undefined,
          datos: b.xposed_data || undefined,
        }))
    } catch (e) {
      // 404 = email sin filtraciones conocidas.
      if (e instanceof ErrorFuente && e.message.includes('404')) return []
      throw e
    }
  })
}
