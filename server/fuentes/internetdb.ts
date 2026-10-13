// Shodan InternetDB. Shodan ya escaneó internet entero; le pedimos la foto ya
// hecha de una IP (puertos abiertos, software/CPE y CVE conocidas). Sin clave,
// gratis. No escaneamos nosotros: pedimos lo que un tercero ya tenía.

import { conCache } from '../cache'
import { ErrorFuente, obtenerJson } from '../http'

export interface InfoIp {
  ip: string
  ports: number[]
  cpes: string[]
  vulns: string[]
  hostnames: string[]
}

const TTL = 12 * 3600

export async function infoDeIp(ip: string): Promise<InfoIp> {
  const clave = `internetdb:${ip}`
  return conCache(clave, TTL, async () => {
    const url = `https://internetdb.shodan.io/${encodeURIComponent(ip)}`
    try {
      const r = await obtenerJson<Partial<InfoIp>>('internetdb', url, { timeoutMs: 8000 })
      return {
        ip,
        ports: r.ports ?? [],
        cpes: r.cpes ?? [],
        vulns: r.vulns ?? [],
        hostnames: r.hostnames ?? [],
      }
    } catch (e) {
      // 404 = IP sin información indexada: no es un error, es "nada que enseñar".
      if (e instanceof ErrorFuente && e.message.includes('404')) {
        return { ip, ports: [], cpes: [], vulns: [], hostnames: [] }
      }
      throw e
    }
  })
}
