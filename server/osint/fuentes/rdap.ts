// RDAP: el "whois" moderno, en JSON y estandarizado. De un dominio saca el
// registrador y las fechas de registro/expiración; de una IP, la organización
// que la tiene asignada y el país. Público y sin clave (con las cabeceras
// correctas: hay que pedir application/rdap+json).

import { conCache } from '../../cache'
import { ErrorFuente, obtenerJson } from '../../http'

const CAB = { 'User-Agent': 'Mozilla/5.0 (ATALAYA OSINT)', Accept: 'application/rdap+json' }
const TTL = 24 * 3600

interface Vcard {
  vcardArray?: [string, Array<[string, unknown, string, string]>]
  roles?: string[]
}

interface RespRdap {
  events?: Array<{ eventAction?: string; eventDate?: string }>
  entities?: Vcard[]
  name?: string
  country?: string
  handle?: string
}

function nombreVcard(e?: Vcard): string | undefined {
  const fn = e?.vcardArray?.[1]?.find((c) => c[0] === 'fn')
  return fn ? String(fn[3]) : undefined
}

function fecha(r: RespRdap, accion: string): string | undefined {
  const ev = r.events?.find((e) => e.eventAction === accion)
  return ev?.eventDate ? ev.eventDate.slice(0, 10) : undefined
}

export interface WhoisDominio {
  registrador?: string
  registrado?: string
  expira?: string
}

export async function rdapDominio(dominio: string): Promise<WhoisDominio | null> {
  const clave = `rdap:dom:${dominio.toLowerCase()}`
  return conCache(clave, TTL, async () => {
    try {
      const d = await obtenerJson<RespRdap>('rdap', `https://rdap.org/domain/${encodeURIComponent(dominio)}`, {
        timeoutMs: 9000,
        headers: CAB,
      })
      const reg = d.entities?.find((e) => e.roles?.includes('registrar'))
      return {
        registrador: nombreVcard(reg),
        registrado: fecha(d, 'registration'),
        expira: fecha(d, 'expiration'),
      }
    } catch (e) {
      if (e instanceof ErrorFuente) return null
      throw e
    }
  })
}

export interface WhoisIp {
  organizacion?: string
  pais?: string
  handle?: string
}

export async function rdapIp(ip: string): Promise<WhoisIp | null> {
  const clave = `rdap:ip:${ip}`
  return conCache(clave, TTL, async () => {
    try {
      const d = await obtenerJson<RespRdap>('rdap', `https://rdap.org/ip/${encodeURIComponent(ip)}`, {
        timeoutMs: 9000,
        headers: CAB,
      })
      const org = d.entities?.find((e) => e.roles?.includes('registrant') || e.roles?.includes('administrative'))
      return {
        organizacion: nombreVcard(org) || d.name,
        pais: d.country,
        handle: d.handle,
      }
    } catch (e) {
      if (e instanceof ErrorFuente) return null
      throw e
    }
  })
}
