// Caso de demostración del apartado OSINT. Es una persona y una organización
// FICTICIAS (nadie real); el email usa un dominio de ejemplo y las IPs son de los
// rangos reservados a documentación (RFC 5737). Sirve para que la demo del
// portfolio abra al instante y se vea el pivoteo completo sin consultar a nadie
// ni exponer datos de una persona real.

import type { Entidad, GrafoOsint, Relacion, ResultadoOsint, TipoEntidad } from '../engine/osint/tipos'
import { idEntidad, normalizarValor } from '../engine/osint/normalizar'

export const INSTANTANEA_OSINT = '2026-10-01'

const EMAIL_DEMO = 'alex.rivera@nube-ejemplo.es'

export interface CasoDemoOsint {
  semilla: { tipo: TipoEntidad; valor: string }
  titulo: string
  descripcion: string
}

export const CASOS_DEMO_OSINT: CasoDemoOsint[] = [
  {
    semilla: { tipo: 'email', valor: EMAIL_DEMO },
    titulo: 'Email de ejemplo',
    descripcion:
      'Parte de un correo y pivota a nombre, cuentas, filtraciones, dominio corporativo, proveedores e infraestructura.',
  },
]

function construir(): GrafoOsint {
  const entidades: Entidad[] = []
  const relaciones: Relacion[] = []

  function ent(
    tipo: TipoEntidad,
    valor: string,
    o: { etiqueta?: string; fuentes?: string[]; confianza?: Entidad['confianza']; meta?: Record<string, string>; semilla?: boolean } = {},
  ): string {
    const v = normalizarValor(tipo, valor)
    const id = idEntidad(tipo, v)
    if (!entidades.some((e) => e.id === id)) {
      entidades.push({
        id,
        tipo,
        valor: v,
        etiqueta: o.etiqueta ?? v,
        semilla: Boolean(o.semilla),
        fuentes: o.fuentes ?? [],
        confianza: o.confianza ?? 'media',
        meta: o.meta ?? {},
      })
    }
    return id
  }
  const rel = (a: string, b: string, tipo: string) => relaciones.push({ desde: a, hasta: b, tipo })

  // Semilla.
  const email = ent('email', EMAIL_DEMO, { semilla: true, confianza: 'alta' })

  // Derivadas del email.
  const usuario = ent('usuario', 'alex.rivera', { fuentes: ['derivado'], confianza: 'baja' })
  const dominio = ent('dominio', 'nube-ejemplo.es', { fuentes: ['derivado'], confianza: 'alta', meta: { registrado: '2017-03-12', expira: '2027-03-12' } })
  rel(email, usuario, 'usuario probable')
  rel(email, dominio, 'dominio del correo')

  // Gravatar: identidad y cuentas.
  const persona = ent('persona', 'Alex Rivera', { etiqueta: 'Alex Rivera', fuentes: ['gravatar', 'github'], confianza: 'media', meta: { ubicacion: 'Barcelona, España' } })
  rel(email, persona, 'identidad')
  const cTw = ent('cuenta', 'https://twitter.com/alexr_dev', { etiqueta: 'twitter · alexr_dev', fuentes: ['gravatar'], meta: { servicio: 'twitter', url: 'https://twitter.com/alexr_dev' } })
  const cLi = ent('cuenta', 'https://www.linkedin.com/in/alexrivera', { etiqueta: 'linkedin · alexrivera', fuentes: ['gravatar'], meta: { servicio: 'linkedin', url: 'https://www.linkedin.com/in/alexrivera' } })
  rel(email, cTw, 'perfil')
  rel(email, cLi, 'perfil')

  // Brechas.
  for (const b of [
    { n: 'LinkedIn', f: '2021-06-01', r: '700000000' },
    { n: 'Dropbox', f: '2012-07-01', r: '68000000' },
    { n: 'Adobe', f: '2013-10-01', r: '153000000' },
  ]) {
    const bid = ent('brecha', b.n, { etiqueta: b.n, fuentes: ['xposedornot'], confianza: 'alta', meta: { fecha: b.f, registros: b.r } })
    rel(email, bid, 'filtrado en')
  }

  // GitHub del usuario.
  const cGh = ent('cuenta', 'https://github.com/alexrivera', { etiqueta: 'GitHub · alexrivera', fuentes: ['github'], confianza: 'alta', meta: { servicio: 'github', url: 'https://github.com/alexrivera' } })
  rel(usuario, cGh, 'perfil')
  rel(usuario, persona, 'identidad')
  const org = ent('organizacion', 'Nube Ejemplo S.L.', { etiqueta: 'Nube Ejemplo S.L.', fuentes: ['github'], confianza: 'media' })
  rel(usuario, org, 'empresa')
  const blog = ent('dominio', 'alexrivera.dev', { fuentes: ['github'], confianza: 'media' })
  rel(usuario, blog, 'web personal')

  // Infraestructura del dominio corporativo.
  for (const s of ['www.nube-ejemplo.es', 'correo.nube-ejemplo.es', 'vpn.nube-ejemplo.es']) {
    const sid = ent('dominio', s, { fuentes: ['hackertarget'], confianza: 'alta' })
    rel(dominio, sid, 'subdominio')
  }
  const ip = ent('ip', '203.0.113.33', { fuentes: ['dns'], confianza: 'alta', meta: { pais: 'ES', puertos: '443, 80, 22', cves: '2' } })
  rel(dominio, ip, 'resuelve a')

  const m365 = ent('organizacion', 'Microsoft 365', { etiqueta: 'Microsoft 365', fuentes: ['dns'], confianza: 'media', meta: { rol: 'correo' } })
  const cf = ent('organizacion', 'Cloudflare', { etiqueta: 'Cloudflare', fuentes: ['dns'], confianza: 'media', meta: { rol: 'dns' } })
  const godaddy = ent('organizacion', 'GoDaddy', { etiqueta: 'GoDaddy', fuentes: ['rdap'], confianza: 'alta', meta: { rol: 'registrador' } })
  rel(dominio, m365, 'correo en')
  rel(dominio, cf, 'DNS en')
  rel(dominio, godaddy, 'registrado por')
  for (const saas of ['Atlassian', 'Stripe']) {
    const sid = ent('organizacion', saas, { etiqueta: saas, fuentes: ['dns'], confianza: 'baja', meta: { rol: 'saas' } })
    rel(dominio, sid, 'usa')
  }

  // Alojamiento de la IP.
  const aws = ent('organizacion', 'Amazon AWS', { etiqueta: 'Amazon AWS', fuentes: ['rdap'], confianza: 'alta', meta: { rol: 'hosting' } })
  rel(ip, aws, 'alojado en')
  const inverso = ent('dominio', 'ec2-203-0-113-33.eu-west-1.compute.amazonaws.com', { fuentes: ['internetdb'], confianza: 'media' })
  rel(ip, inverso, 'DNS inverso')

  return { entidades, relaciones }
}

export function esCasoDemoOsint(semillas: Array<{ tipo: TipoEntidad; valor: string }>): boolean {
  return semillas.length === 1 && semillas[0].tipo === 'email' && semillas[0].valor.toLowerCase() === EMAIL_DEMO
}

export function osintSembrado(fechaIso: string): ResultadoOsint {
  return {
    grafo: construir(),
    semillas: [{ tipo: 'email', valor: EMAIL_DEMO }],
    generadoEn: fechaIso,
    modo: 'sembrado',
    fuentes: ['gravatar', 'xposedornot', 'github', 'hackertarget', 'dns', 'rdap', 'internetdb'],
    parcial: false,
    avisos: [],
  }
}
