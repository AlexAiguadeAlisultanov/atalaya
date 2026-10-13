// GitHub: de un nombre de usuario a su perfil público. Nombre real, empresa, web,
// ubicación, repos y cuentas sociales enlazadas. Gran fuente de pivoteo. API sin
// clave (límite 60 peticiones/hora por IP), así que cacheamos.

import { conCache } from '../../cache'
import { ErrorFuente, obtenerJson } from '../../http'

export interface CuentaSocial {
  proveedor: string
  url: string
}

export interface PerfilGithub {
  usuario: string
  nombre?: string
  empresa?: string
  web?: string
  ubicacion?: string
  bio?: string
  repos?: number
  seguidores?: number
  sociales: CuentaSocial[]
}

interface RespUsuario {
  login: string
  name?: string | null
  company?: string | null
  blog?: string | null
  location?: string | null
  bio?: string | null
  public_repos?: number
  followers?: number
}

const CAB = { 'User-Agent': 'ATALAYA-OSINT', Accept: 'application/vnd.github+json' }
const TTL = 12 * 3600

export async function perfilGithub(usuario: string): Promise<PerfilGithub | null> {
  const u = usuario.trim().toLowerCase()
  const clave = `github:${u}`
  return conCache(clave, TTL, async () => {
    try {
      const d = await obtenerJson<RespUsuario>('github', `https://api.github.com/users/${encodeURIComponent(u)}`, {
        timeoutMs: 9000,
        headers: CAB,
      })
      let sociales: CuentaSocial[] = []
      try {
        const s = await obtenerJson<Array<{ provider: string; url: string }>>(
          'github',
          `https://api.github.com/users/${encodeURIComponent(u)}/social_accounts`,
          { timeoutMs: 8000, headers: CAB },
        )
        sociales = s.map((x) => ({ proveedor: x.provider, url: x.url }))
      } catch {
        // Las cuentas sociales son opcionales.
      }
      return {
        usuario: d.login,
        nombre: d.name ?? undefined,
        empresa: d.company ?? undefined,
        web: d.blog ?? undefined,
        ubicacion: d.location ?? undefined,
        bio: d.bio ?? undefined,
        repos: d.public_repos,
        seguidores: d.followers,
        sociales,
      }
    } catch (e) {
      // 404 = ese usuario no existe en GitHub.
      if (e instanceof ErrorFuente && e.message.includes('404')) return null
      throw e
    }
  })
}
