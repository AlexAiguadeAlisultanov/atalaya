// Catálogo KEV de CISA (Known Exploited Vulnerabilities): la lista oficial de
// vulnerabilidades que se están explotando DE VERDAD ahí fuera. Si un CVE está
// aquí, es prioridad máxima. Se descarga entero una vez y se cachea.

import { conCache } from '../cache'
import { obtenerJson } from '../http'

interface FeedKev {
  vulnerabilities?: Array<{ cveID: string; dueDate?: string }>
}

const TTL = 12 * 3600

/** Devuelve un mapa id de CVE -> fecha límite de CISA (o cadena vacía si no la da). */
export async function mapaKev(): Promise<Record<string, string>> {
  return conCache('kev:catalogo', TTL, async () => {
    const url = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json'
    const feed = await obtenerJson<FeedKev>('kev', url, { timeoutMs: 15000 })
    const mapa: Record<string, string> = {}
    for (const v of feed.vulnerabilities ?? []) {
      mapa[v.cveID.toUpperCase()] = v.dueDate ?? ''
    }
    return mapa
  })
}
