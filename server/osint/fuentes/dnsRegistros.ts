// Registros DNS de un dominio por DNS-over-HTTPS: MX (quién le lleva el correo),
// NS (quién le lleva el DNS) y TXT (SPF y verificaciones, que delatan qué SaaS
// usa). Son huellas públicas muy útiles para pivotar a proveedores.

import { conCache } from '../../cache'
import { obtenerJson } from '../../http'

interface RespDoh {
  Answer?: Array<{ type: number; data: string }>
}

export interface RegistrosDns {
  mx: string[]
  ns: string[]
  txt: string[]
}

const TTL = 3600

async function consulta(dominio: string, tipo: string): Promise<string[]> {
  try {
    const r = await obtenerJson<RespDoh>('dns', `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(dominio)}&type=${tipo}`, {
      headers: { Accept: 'application/dns-json' },
      timeoutMs: 6000,
    })
    return (r.Answer ?? []).map((a) => a.data.replace(/"/g, '').trim()).filter(Boolean)
  } catch {
    return []
  }
}

export async function registrosDns(dominio: string): Promise<RegistrosDns> {
  const clave = `dnsreg:${dominio.toLowerCase()}`
  return conCache(clave, TTL, async () => {
    const [mx, ns, txt] = await Promise.all([
      consulta(dominio, 'MX'),
      consulta(dominio, 'NS'),
      consulta(dominio, 'TXT'),
    ])
    // MX viene como "10 mail.host."; nos quedamos con el host.
    const mxHosts = mx.map((m) => m.split(/\s+/).pop() || m).map((h) => h.replace(/\.$/, ''))
    const nsHosts = ns.map((h) => h.replace(/\.$/, ''))
    return { mx: mxHosts, ns: nsHosts, txt }
  })
}
