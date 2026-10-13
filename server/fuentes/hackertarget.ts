// HackerTarget (hostsearch). Fuente pasiva de respaldo para descubrir
// subdominios: devuelve pares "subdominio,IP" en texto, rápido y sin clave.
// Es el plan B cuando crt.sh está lento o caído, y de paso aporta la IP ya
// resuelta. Tiene límite diario gratuito; si se agota, devuelve [] sin romper.

import { conCache } from '../cache'
import { obtenerTexto } from '../http'

export interface ParHostIp {
  host: string
  ip: string
}

const TTL = 24 * 3600
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

export async function hostsearch(dominio: string, limite = 80): Promise<ParHostIp[]> {
  const clave = `hackertarget:${dominio}`
  return conCache(clave, TTL, async () => {
    const url = `https://api.hackertarget.com/hostsearch/?q=${encodeURIComponent(dominio)}`
    let texto: string
    try {
      texto = await obtenerTexto('hackertarget', url, { timeoutMs: 9000 })
    } catch {
      return []
    }
    // Cuando se agota la cuota o el dominio no existe, responde con una frase, no CSV.
    if (/error|api count|no records|not found/i.test(texto) && !texto.includes(',')) return []

    const pares: ParHostIp[] = []
    for (const linea of texto.split('\n')) {
      const [host, ip] = linea.trim().split(',')
      if (!host || !ip || !IPV4.test(ip)) continue
      const h = host.toLowerCase()
      if (h === dominio || h.endsWith(`.${dominio}`)) pares.push({ host: h, ip })
    }
    return pares.slice(0, limite)
  })
}
