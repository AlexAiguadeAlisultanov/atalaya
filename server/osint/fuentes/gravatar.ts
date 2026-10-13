// Gravatar: de un email a su perfil público (si lo tiene). Revela nombre,
// ubicación y, sobre todo, CUENTAS vinculadas en otros servicios, que es un gran
// punto de pivoteo. Fuente pasiva pura: Gravatar es público y no avisa a nadie.

import { createHash } from 'node:crypto'
import { conCache } from '../../cache'
import { ErrorFuente, obtenerJson } from '../../http'

export interface CuentaGravatar {
  servicio: string
  url: string
  usuario?: string
}

export interface PerfilGravatar {
  nombre?: string
  ubicacion?: string
  cuentas: CuentaGravatar[]
  urls: string[]
}

interface RespuestaGravatar {
  entry?: Array<{
    displayName?: string
    name?: { formatted?: string }
    currentLocation?: string
    accounts?: Array<{ shortname?: string; domain?: string; display?: string; url?: string; username?: string }>
    urls?: Array<{ value?: string; title?: string }>
  }>
}

const TTL = 24 * 3600

export async function perfilGravatar(email: string): Promise<PerfilGravatar | null> {
  const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex')
  const clave = `gravatar:${hash}`
  return conCache(clave, TTL, async () => {
    try {
      const d = await obtenerJson<RespuestaGravatar>('gravatar', `https://www.gravatar.com/${hash}.json`, {
        timeoutMs: 8000,
        headers: { 'User-Agent': 'Mozilla/5.0 (ATALAYA OSINT)' },
      })
      const e = d.entry?.[0]
      if (!e) return null
      const cuentas: CuentaGravatar[] = (e.accounts ?? [])
        .filter((a) => a.url)
        .map((a) => ({ servicio: a.shortname || a.domain || a.display || 'cuenta', url: a.url!, usuario: a.username }))
      return {
        nombre: e.displayName || e.name?.formatted,
        ubicacion: e.currentLocation,
        cuentas,
        urls: (e.urls ?? []).map((u) => u.value).filter(Boolean) as string[],
      }
    } catch (e) {
      // 404 = ese email no tiene Gravatar: no es un error.
      if (e instanceof ErrorFuente && e.message.includes('404')) return null
      throw e
    }
  })
}
