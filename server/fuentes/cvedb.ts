// Shodan CVEDB. Para un id de CVE devuelve, en UNA sola llamada rápida y sin
// clave, la puntuación CVSS, el EPSS (probabilidad de explotación) y si está en
// el catálogo KEV de CISA. Agrega NVD + EPSS + KEV, así que evita el límite
// estricto de NVD (5 pet/30s) que hacía lento el análisis en vivo de dominios
// con muchas vulnerabilidades. Se cachea 24 h.

import { cacheGuardar, cacheObtener } from '../cache'
import { ErrorFuente, obtenerJson } from '../http'

interface RespuestaCvedb {
  cvss?: number
  cvss_v3?: number
  epss?: number
  kev?: boolean
  summary?: string
}

export interface EnriquecimientoCve {
  cvss: number
  epss: number
  kev: boolean
  descripcion?: string
}

const TTL = 24 * 3600

export async function enriquecerCve(id: string): Promise<EnriquecimientoCve> {
  const cveId = id.toUpperCase()
  const clave = `cvedb:${cveId}`
  const guardado = cacheObtener<EnriquecimientoCve>(clave)
  if (guardado !== undefined) return guardado

  try {
    const d = await obtenerJson<RespuestaCvedb>('cvedb', `https://cvedb.shodan.io/cve/${encodeURIComponent(cveId)}`, {
      timeoutMs: 9000,
    })
    const datos: EnriquecimientoCve = {
      cvss: d.cvss_v3 ?? d.cvss ?? 0,
      epss: d.epss ?? 0,
      kev: Boolean(d.kev),
      descripcion: d.summary,
    }
    cacheGuardar(clave, datos, TTL)
    return datos
  } catch (e) {
    // No cacheamos el fallo: se reintentará en el próximo análisis.
    if (e instanceof ErrorFuente) return { cvss: 0, epss: 0, kev: false }
    throw e
  }
}
