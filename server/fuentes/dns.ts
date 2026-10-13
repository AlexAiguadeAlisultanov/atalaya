// DNS-over-HTTPS (Cloudflare). El DNS es la agenda de internet: traduce un nombre
// a su IP. Resolvemos cada subdominio a sus registros A para saber dónde vive.

import { conCache } from '../cache'
import { obtenerJson } from '../http'

interface RespuestaDoh {
  Status: number
  Answer?: Array<{ name: string; type: number; TTL: number; data: string }>
}

const TTL = 3600
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

export async function resolverA(host: string): Promise<string[]> {
  const clave = `dns:${host}`
  return conCache(clave, TTL, async () => {
    const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=A`
    try {
      const r = await obtenerJson<RespuestaDoh>('dns', url, {
        headers: { Accept: 'application/dns-json' },
        timeoutMs: 6000,
      })
      const ips = (r.Answer ?? [])
        .filter((a) => a.type === 1 && IPV4.test(a.data))
        .map((a) => a.data)
      return [...new Set(ips)]
    } catch {
      return []
    }
  })
}
