// Orquestador del pivoteo OSINT. Recibe semillas (email, usuario, dominio, IP) y
// hace un recorrido en anchura (BFS) por fuentes públicas y pasivas, descubriendo
// entidades nuevas y conectándolas. Acotado: profundidad, número de entidades y
// topes por fuente, para ir rápido y no explotar. Toda la fragilidad de las
// fuentes queda aislada aquí con degradación elegante.

import type { Entidad, Relacion, ResultadoOsint, TipoEntidad } from '../../src/engine/osint/tipos'
import { idEntidad, normalizarValor } from '../../src/engine/osint/normalizar'
import { perfilGravatar } from './fuentes/gravatar'
import { brechasDeEmail } from './fuentes/xposedornot'
import { perfilGithub } from './fuentes/github'
import { rdapDominio, rdapIp } from './fuentes/rdap'
import { registrosDns } from './fuentes/dnsRegistros'
import { hostsearch } from '../fuentes/hackertarget'
import { resolverA } from '../fuentes/dns'
import { infoDeIp } from '../fuentes/internetdb'
import { proveedorDeHost, saasDeTxt } from './proveedores'

const MAX_PROFUNDIDAD = 2
const MAX_ENTIDADES = 70
const MAX_SUBS = 8
const MAX_IPS = 4
const MAX_HOSTS = 4
const MAX_BRECHAS = 8

interface Acumulador {
  entidades: Map<string, Entidad>
  relaciones: Relacion[]
  fuentes: Set<string>
  avisos: string[]
  parcial: boolean
}

interface DatosEntidad {
  tipo: TipoEntidad
  valor: string
  etiqueta?: string
  fuente?: string
  confianza?: Entidad['confianza']
  meta?: Record<string, string>
  semilla?: boolean
}

function anadir(acc: Acumulador, d: DatosEntidad): string {
  const valor = normalizarValor(d.tipo, d.valor)
  const id = idEntidad(d.tipo, valor)
  const existe = acc.entidades.get(id)
  if (existe) {
    if (d.fuente && !existe.fuentes.includes(d.fuente)) existe.fuentes.push(d.fuente)
    if (d.meta) Object.assign(existe.meta, d.meta)
    if (d.semilla) existe.semilla = true
    return id
  }
  acc.entidades.set(id, {
    id,
    tipo: d.tipo,
    valor,
    etiqueta: d.etiqueta ?? valor,
    semilla: Boolean(d.semilla),
    fuentes: d.fuente ? [d.fuente] : [],
    confianza: d.confianza ?? 'media',
    meta: d.meta ?? {},
  })
  return id
}

function relacionar(acc: Acumulador, desde: string, hasta: string, tipo: string): void {
  if (desde === hasta) return
  if (!acc.relaciones.some((r) => r.desde === desde && r.hasta === hasta && r.tipo === tipo)) {
    acc.relaciones.push({ desde, hasta, tipo })
  }
}

function dominioDeUrl(bruto: string): string | null {
  try {
    const u = new URL(bruto.includes('://') ? bruto : `https://${bruto}`)
    const h = u.hostname.toLowerCase()
    return /\.[a-z]{2,}$/.test(h) ? h : null
  } catch {
    return null
  }
}

// ---------- Expansores por tipo ----------

async function expandirEmail(acc: Acumulador, ent: Entidad): Promise<string[]> {
  const nuevos: string[] = []
  const [local, dominio] = ent.valor.split('@')
  if (local) {
    const uid = anadir(acc, { tipo: 'usuario', valor: local, fuente: 'derivado', confianza: 'baja' })
    relacionar(acc, ent.id, uid, 'usuario probable')
    nuevos.push(uid)
  }
  if (dominio) {
    const did = anadir(acc, { tipo: 'dominio', valor: dominio, fuente: 'derivado', confianza: 'alta' })
    relacionar(acc, ent.id, did, 'dominio del correo')
    nuevos.push(did)
  }

  try {
    const g = await perfilGravatar(ent.valor)
    if (g) {
      acc.fuentes.add('gravatar')
      if (g.nombre) {
        const pid = anadir(acc, {
          tipo: 'persona',
          valor: g.nombre,
          etiqueta: g.nombre,
          fuente: 'gravatar',
          confianza: 'media',
          meta: g.ubicacion ? { ubicacion: g.ubicacion } : {},
        })
        relacionar(acc, ent.id, pid, 'identidad')
      }
      for (const c of g.cuentas) {
        const cid = anadir(acc, {
          tipo: 'cuenta',
          valor: c.url,
          etiqueta: c.servicio + (c.usuario ? ` · ${c.usuario}` : ''),
          fuente: 'gravatar',
          confianza: 'media',
          meta: { url: c.url, servicio: c.servicio },
        })
        relacionar(acc, ent.id, cid, 'perfil')
      }
    }
  } catch {
    acc.parcial = true
  }

  try {
    const brechas = await brechasDeEmail(ent.valor)
    if (brechas.length) acc.fuentes.add('xposedornot')
    for (const b of brechas.slice(0, MAX_BRECHAS)) {
      const bid = anadir(acc, {
        tipo: 'brecha',
        valor: b.nombre,
        etiqueta: b.nombre,
        fuente: 'xposedornot',
        confianza: 'alta',
        meta: {
          ...(b.fecha ? { fecha: b.fecha } : {}),
          ...(b.registros ? { registros: b.registros } : {}),
          ...(b.datos ? { datos: b.datos } : {}),
        },
      })
      relacionar(acc, ent.id, bid, 'filtrado en')
    }
    if (brechas.length > MAX_BRECHAS) {
      acc.avisos.push(`${ent.valor} aparece en ${brechas.length} filtraciones; se muestran las primeras ${MAX_BRECHAS}.`)
    }
  } catch {
    acc.parcial = true
  }

  return nuevos
}

async function expandirUsuario(acc: Acumulador, ent: Entidad): Promise<string[]> {
  const nuevos: string[] = []
  try {
    const g = await perfilGithub(ent.valor)
    if (g) {
      acc.fuentes.add('github')
      ent.confianza = 'alta'
      if (g.repos !== undefined) ent.meta.repos = String(g.repos)
      if (g.bio) ent.meta.bio = g.bio
      const cuentaGh = anadir(acc, {
        tipo: 'cuenta',
        valor: `https://github.com/${g.usuario}`,
        etiqueta: `GitHub · ${g.usuario}`,
        fuente: 'github',
        confianza: 'alta',
        meta: { url: `https://github.com/${g.usuario}`, servicio: 'github' },
      })
      relacionar(acc, ent.id, cuentaGh, 'perfil')
      if (g.nombre) {
        const pid = anadir(acc, { tipo: 'persona', valor: g.nombre, etiqueta: g.nombre, fuente: 'github', confianza: 'media', meta: g.ubicacion ? { ubicacion: g.ubicacion } : {} })
        relacionar(acc, ent.id, pid, 'identidad')
      }
      if (g.empresa) {
        const oid = anadir(acc, { tipo: 'organizacion', valor: g.empresa.replace(/^@/, ''), etiqueta: g.empresa, fuente: 'github', confianza: 'media' })
        relacionar(acc, ent.id, oid, 'empresa')
      }
      if (g.web) {
        const dom = dominioDeUrl(g.web)
        if (dom) {
          const did = anadir(acc, { tipo: 'dominio', valor: dom, fuente: 'github', confianza: 'media' })
          relacionar(acc, ent.id, did, 'web personal')
          nuevos.push(did)
        }
      }
      for (const s of g.sociales) {
        const sid = anadir(acc, { tipo: 'cuenta', valor: s.url, etiqueta: `${s.proveedor}`, fuente: 'github', confianza: 'media', meta: { url: s.url, servicio: s.proveedor } })
        relacionar(acc, ent.id, sid, 'perfil')
      }
    }
  } catch {
    acc.parcial = true
  }
  return nuevos
}

async function expandirDominio(acc: Acumulador, ent: Entidad): Promise<string[]> {
  const nuevos: string[] = []
  const dominio = ent.valor

  // Subdominios (rápido, por hackertarget; en OSINT no esperamos a crt.sh).
  try {
    const pares = await hostsearch(dominio, 40)
    if (pares.length) acc.fuentes.add('hackertarget')
    const subs = [...new Set(pares.map((p) => p.host))].filter((h) => h !== dominio).slice(0, MAX_SUBS)
    for (const s of subs) {
      const sid = anadir(acc, { tipo: 'dominio', valor: s, fuente: 'hackertarget', confianza: 'alta' })
      relacionar(acc, ent.id, sid, 'subdominio')
    }
  } catch {
    acc.parcial = true
  }

  // Registros DNS: IPs, proveedor de correo, de DNS y SaaS por TXT.
  try {
    const reg = await registrosDns(dominio)
    acc.fuentes.add('dns')
    for (const h of reg.mx) {
      const prov = proveedorDeHost(h)
      if (prov) {
        const oid = anadir(acc, { tipo: 'organizacion', valor: prov, etiqueta: prov, fuente: 'dns', confianza: 'media', meta: { rol: 'correo' } })
        relacionar(acc, ent.id, oid, 'correo en')
      }
    }
    for (const h of reg.ns) {
      const prov = proveedorDeHost(h)
      if (prov) {
        const oid = anadir(acc, { tipo: 'organizacion', valor: prov, etiqueta: prov, fuente: 'dns', confianza: 'media', meta: { rol: 'dns' } })
        relacionar(acc, ent.id, oid, 'DNS en')
      }
    }
    for (const saas of saasDeTxt(reg.txt)) {
      const oid = anadir(acc, { tipo: 'organizacion', valor: saas, etiqueta: saas, fuente: 'dns', confianza: 'baja', meta: { rol: 'saas' } })
      relacionar(acc, ent.id, oid, 'usa')
    }
  } catch {
    acc.parcial = true
  }

  // IPs a las que resuelve.
  try {
    const ips = (await resolverA(dominio)).slice(0, MAX_IPS)
    if (ips.length) acc.fuentes.add('dns')
    for (const ip of ips) {
      const iid = anadir(acc, { tipo: 'ip', valor: ip, fuente: 'dns', confianza: 'alta' })
      relacionar(acc, ent.id, iid, 'resuelve a')
      nuevos.push(iid)
    }
  } catch {
    acc.parcial = true
  }

  // Whois (RDAP): registrador y fechas en los metadatos.
  try {
    const w = await rdapDominio(dominio)
    if (w) {
      acc.fuentes.add('rdap')
      if (w.registrado) ent.meta.registrado = w.registrado
      if (w.expira) ent.meta.expira = w.expira
      if (w.registrador) {
        const oid = anadir(acc, { tipo: 'organizacion', valor: w.registrador, etiqueta: w.registrador, fuente: 'rdap', confianza: 'alta', meta: { rol: 'registrador' } })
        relacionar(acc, ent.id, oid, 'registrado por')
      }
    }
  } catch {
    acc.parcial = true
  }

  return nuevos
}

async function expandirIp(acc: Acumulador, ent: Entidad): Promise<string[]> {
  const nuevos: string[] = []
  try {
    const info = await infoDeIp(ent.valor)
    acc.fuentes.add('internetdb')
    if (info.ports.length) ent.meta.puertos = info.ports.slice(0, 12).join(', ')
    if (info.vulns.length) ent.meta.cves = String(info.vulns.length)
    for (const h of info.hostnames.slice(0, MAX_HOSTS)) {
      const did = anadir(acc, { tipo: 'dominio', valor: h, fuente: 'internetdb', confianza: 'media' })
      relacionar(acc, ent.id, did, 'DNS inverso')
    }
  } catch {
    acc.parcial = true
  }
  try {
    const w = await rdapIp(ent.valor)
    if (w) {
      acc.fuentes.add('rdap')
      if (w.pais) ent.meta.pais = w.pais
      if (w.organizacion) {
        const oid = anadir(acc, { tipo: 'organizacion', valor: w.organizacion, etiqueta: w.organizacion, fuente: 'rdap', confianza: 'alta', meta: { rol: 'hosting' } })
        relacionar(acc, ent.id, oid, 'alojado en')
      }
    }
  } catch {
    acc.parcial = true
  }
  return nuevos
}

async function expandir(acc: Acumulador, ent: Entidad): Promise<string[]> {
  switch (ent.tipo) {
    case 'email':
      return expandirEmail(acc, ent)
    case 'usuario':
      return expandirUsuario(acc, ent)
    case 'dominio':
      return expandirDominio(acc, ent)
    case 'ip':
      return expandirIp(acc, ent)
    default:
      return []
  }
}

export async function pivotar(
  semillas: Array<{ tipo: TipoEntidad; valor: string }>,
  fechaIso: string,
): Promise<ResultadoOsint> {
  const acc: Acumulador = {
    entidades: new Map(),
    relaciones: [],
    fuentes: new Set(),
    avisos: [],
    parcial: false,
  }

  const cola: Array<{ id: string; profundidad: number }> = []
  for (const s of semillas) {
    const id = anadir(acc, { tipo: s.tipo, valor: s.valor, semilla: true, confianza: 'alta' })
    cola.push({ id, profundidad: 0 })
  }

  const expandidos = new Set<string>()
  let truncado = false
  while (cola.length) {
    const { id, profundidad } = cola.shift()!
    if (expandidos.has(id)) continue
    expandidos.add(id)
    if (profundidad > MAX_PROFUNDIDAD) continue
    if (acc.entidades.size >= MAX_ENTIDADES) {
      truncado = true
      break
    }
    const ent = acc.entidades.get(id)
    if (!ent) continue
    const nuevos = await expandir(acc, ent)
    for (const nid of nuevos) cola.push({ id: nid, profundidad: profundidad + 1 })
  }
  if (truncado) acc.avisos.push(`Se alcanzó el tope de ${MAX_ENTIDADES} entidades; el grafo puede estar incompleto.`)

  return {
    grafo: { entidades: [...acc.entidades.values()], relaciones: acc.relaciones },
    semillas,
    generadoEn: fechaIso,
    modo: 'vivo',
    fuentes: [...acc.fuentes],
    parcial: acc.parcial,
    avisos: acc.avisos,
  }
}
