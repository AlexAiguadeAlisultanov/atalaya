// Motor de dossier OSINT: toma todo lo que el pivoteo recopiló (el grafo de
// entidades) y lo CONECTA y ORGANIZA en un informe legible, listo para exportar a
// PDF. Es determinista y basado en reglas: no inventa nada, solo cruza lo que ya
// está en el grafo (quién se confirma por varias fuentes, quién vincula a quién,
// qué cadena de pivoteo llevó a cada hallazgo). Pura: mismo grafo -> mismo
// informe. La interfaz solo lo pinta.

import type { Confianza, Entidad, Relacion, ResultadoOsint, TipoEntidad } from './tipos'

export interface Identidad {
  persona?: string
  ubicacion?: string
  emails: string[]
  usuarios: string[]
  cuentas: Array<{ servicio: string; url: string }>
  organizaciones: string[]
  confianza: Confianza
}

export interface ExposicionOsint {
  emailsExpuestos: string[]
  brechas: Array<{ nombre: string; fecha?: string; registros?: string; datos?: string }>
}

export interface BloqueInfra {
  dominio: string
  registrado?: string
  expira?: string
  registrador?: string
  subdominios: string[]
  ips: Array<{ ip: string; pais?: string; puertos?: string; cves?: string; hosting?: string }>
  correo: string[]
  dns: string[]
  saas: string[]
}

export interface Conexion {
  tipo: 'multi-fuente' | 'vinculo' | 'pivote'
  texto: string
}

export interface HallazgoClave {
  severidad: 'alta' | 'media' | 'baja'
  titulo: string
  detalle: string
}

export interface Evento {
  fecha: string
  texto: string
}

export interface Informe {
  generadoEn: string
  modo: 'sembrado' | 'vivo'
  semillas: Array<{ tipo: TipoEntidad; valor: string }>
  fuentes: string[]
  parcial: boolean
  avisos: string[]
  conteo: Array<{ tipo: TipoEntidad; n: number }>
  totalEntidades: number
  identidades: Identidad[]
  exposicion: ExposicionOsint
  infraestructura: BloqueInfra[]
  cuentasPorServicio: Array<{ servicio: string; cuentas: string[] }>
  organizaciones: Array<{ nombre: string; rol: string }>
  conexiones: Conexion[]
  hallazgosClave: HallazgoClave[]
  cronologia: Evento[]
}

const ORDEN_CONF: Record<Confianza, number> = { alta: 3, media: 2, baja: 1 }
const ORDEN_SEV = { alta: 3, media: 2, baja: 1 } as const
const ROL_LEGIBLE: Record<string, string> = {
  correo: 'proveedor de correo',
  dns: 'proveedor de DNS',
  hosting: 'alojamiento',
  registrador: 'registrador del dominio',
  saas: 'servicio SaaS',
}

const PUERTOS_SENSIBLES = [21, 22, 23, 25, 135, 139, 445, 1433, 3306, 3389, 5432, 5900, 6379, 9200, 27017]

export function construirInforme(resultado: ResultadoOsint): Informe {
  const { entidades, relaciones } = resultado.grafo
  const porId = new Map(entidades.map((e) => [e.id, e]))

  // Vecinos dirigidos: salientes (este -> otro) y entrantes (otro -> este).
  const salientes = new Map<string, Relacion[]>()
  const entrantes = new Map<string, Relacion[]>()
  for (const e of entidades) {
    salientes.set(e.id, [])
    entrantes.set(e.id, [])
  }
  for (const r of relaciones) {
    if (porId.has(r.desde) && porId.has(r.hasta)) {
      salientes.get(r.desde)!.push(r)
      entrantes.get(r.hasta)!.push(r)
    }
  }
  const vecinos = (id: string): Entidad[] => {
    const ids = new Set<string>()
    for (const r of salientes.get(id) ?? []) ids.add(r.hasta)
    for (const r of entrantes.get(id) ?? []) ids.add(r.desde)
    return [...ids].map((x) => porId.get(x)!).filter(Boolean)
  }
  const hacia = (id: string, tipoRel: string, tipoEnt?: TipoEntidad): Entidad[] =>
    (salientes.get(id) ?? [])
      .filter((r) => r.tipo === tipoRel)
      .map((r) => porId.get(r.hasta)!)
      .filter((e) => e && (!tipoEnt || e.tipo === tipoEnt))

  const deTipo = (t: TipoEntidad) => entidades.filter((e) => e.tipo === t)

  // ----- Conteo -----
  const conteoMap = new Map<TipoEntidad, number>()
  for (const e of entidades) conteoMap.set(e.tipo, (conteoMap.get(e.tipo) ?? 0) + 1)
  const conteo = [...conteoMap.entries()].map(([tipo, n]) => ({ tipo, n })).sort((a, b) => b.n - a.n)

  // ----- Identidades (persona + lo que cuelga de ella y de sus emails/usuarios) -----
  const identidades: Identidad[] = []
  for (const p of deTipo('persona')) {
    const emails = new Set<string>()
    const usuarios = new Set<string>()
    const cuentas = new Map<string, { servicio: string; url: string }>()
    const orgs = new Set<string>()
    // Quién apunta a esta persona (emails/usuarios con rel "identidad").
    const origenes = (entrantes.get(p.id) ?? []).map((r) => porId.get(r.desde)!).filter(Boolean)
    for (const o of origenes) {
      if (o.tipo === 'email') emails.add(o.valor)
      if (o.tipo === 'usuario') usuarios.add(o.valor)
      for (const v of vecinos(o.id)) {
        if (v.tipo === 'cuenta') cuentas.set(v.id, { servicio: v.meta.servicio || v.etiqueta, url: v.meta.url || v.valor })
        if (v.tipo === 'organizacion') orgs.add(v.etiqueta)
        if (v.tipo === 'email') emails.add(v.valor)
      }
    }
    for (const v of vecinos(p.id)) {
      if (v.tipo === 'organizacion') orgs.add(v.etiqueta)
    }
    identidades.push({
      persona: p.etiqueta,
      ubicacion: p.meta.ubicacion,
      emails: [...emails],
      usuarios: [...usuarios],
      cuentas: [...cuentas.values()],
      organizaciones: [...orgs],
      confianza: p.confianza,
    })
  }

  // ----- Exposición (brechas) -----
  const brechas = deTipo('brecha').map((b) => ({
    nombre: b.etiqueta,
    fecha: b.meta.fecha,
    registros: b.meta.registros,
    datos: b.meta.datos,
  }))
  const emailsExpuestos = [
    ...new Set(
      deTipo('brecha').flatMap((b) => (entrantes.get(b.id) ?? []).map((r) => porId.get(r.desde)).filter((e): e is Entidad => !!e && e.tipo === 'email').map((e) => e.valor)),
    ),
  ]

  // ----- Infraestructura (por dominio "cabecera": el que tiene subdominios/IPs/proveedores) -----
  const infraestructura: BloqueInfra[] = []
  for (const d of deTipo('dominio')) {
    const subs = hacia(d.id, 'subdominio', 'dominio').map((e) => e.valor)
    const ipsEnt = hacia(d.id, 'resuelve a', 'ip')
    const correo = hacia(d.id, 'correo en', 'organizacion').map((e) => e.etiqueta)
    const dns = hacia(d.id, 'DNS en', 'organizacion').map((e) => e.etiqueta)
    const saas = hacia(d.id, 'usa', 'organizacion').map((e) => e.etiqueta)
    const reg = hacia(d.id, 'registrado por', 'organizacion')[0]
    if (subs.length === 0 && ipsEnt.length === 0 && correo.length === 0 && dns.length === 0 && saas.length === 0 && !reg && !d.meta.registrado) {
      continue // dominio hoja (p. ej. un subdominio); no es cabecera
    }
    infraestructura.push({
      dominio: d.valor,
      registrado: d.meta.registrado,
      expira: d.meta.expira,
      registrador: reg?.etiqueta,
      subdominios: subs,
      ips: ipsEnt.map((ip) => ({
        ip: ip.valor,
        pais: ip.meta.pais,
        puertos: ip.meta.puertos,
        cves: ip.meta.cves,
        hosting: hacia(ip.id, 'alojado en', 'organizacion')[0]?.etiqueta,
      })),
      correo,
      dns,
      saas,
    })
  }

  // ----- Cuentas por servicio -----
  const servicioMap = new Map<string, Set<string>>()
  for (const c of deTipo('cuenta')) {
    const serv = c.meta.servicio || 'otros'
    if (!servicioMap.has(serv)) servicioMap.set(serv, new Set())
    servicioMap.get(serv)!.add(c.meta.url || c.valor)
  }
  const cuentasPorServicio = [...servicioMap.entries()]
    .map(([servicio, urls]) => ({ servicio, cuentas: [...urls] }))
    .sort((a, b) => b.cuentas.length - a.cuentas.length)

  // ----- Organizaciones -----
  const organizaciones = deTipo('organizacion')
    .map((o) => ({ nombre: o.etiqueta, rol: ROL_LEGIBLE[o.meta.rol] || o.meta.rol || 'relacionada' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre))

  // ----- Conexiones (el "conectar los puntos") -----
  const conexiones: Conexion[] = []
  // Multi-fuente: entidades confirmadas por 2+ fuentes.
  for (const e of entidades) {
    if (e.fuentes.length >= 2) {
      conexiones.push({ tipo: 'multi-fuente', texto: `${etiquetaTipo(e.tipo)} "${e.etiqueta}" confirmada por ${e.fuentes.length} fuentes (${e.fuentes.join(', ')}): alta confianza.` })
    }
  }
  // Vínculos: una entidad conectada a 2+ semillas distintas.
  const idsSemilla = new Set(entidades.filter((e) => e.semilla).map((e) => e.id))
  for (const e of entidades) {
    if (e.semilla) continue
    const semillasVinculadas = new Set(
      vecinos(e.id).filter((v) => idsSemilla.has(v.id)).map((v) => v.etiqueta),
    )
    if (semillasVinculadas.size >= 2) {
      conexiones.push({ tipo: 'vinculo', texto: `${etiquetaTipo(e.tipo)} "${e.etiqueta}" conecta ${[...semillasVinculadas].join(' y ')}.` })
    }
  }
  // Pivote: resumen de cómo cada semilla abrió el abanico.
  for (const s of entidades.filter((e) => e.semilla)) {
    const directos = (salientes.get(s.id) ?? []).length
    if (directos > 0) {
      conexiones.push({ tipo: 'pivote', texto: `Desde ${etiquetaTipo(s.tipo)} "${s.etiqueta}" se descubrieron ${directos} datos directos, que a su vez abrieron el resto del grafo.` })
    }
  }

  // ----- Hallazgos clave (ranking) -----
  const hallazgosClave: HallazgoClave[] = []
  for (const em of emailsExpuestos) {
    const n = brechas.length
    hallazgosClave.push({
      severidad: n >= 5 ? 'alta' : n >= 1 ? 'media' : 'baja',
      titulo: `Correo expuesto en filtraciones`,
      detalle: `${em} aparece en ${n} ${n === 1 ? 'filtración' : 'filtraciones'} de datos ${n === 1 ? 'conocida' : 'conocidas'}.`,
    })
  }
  for (const id of identidades) {
    if (id.persona) {
      hallazgosClave.push({
        severidad: id.confianza === 'alta' ? 'alta' : 'media',
        titulo: 'Identidad probable',
        detalle: `${id.persona}${id.ubicacion ? ` (${id.ubicacion})` : ''}, con ${id.cuentas.length} perfil${id.cuentas.length === 1 ? '' : 'es'} vinculado${id.cuentas.length === 1 ? '' : 's'}.`,
      })
    }
  }
  for (const bloque of infraestructura) {
    for (const ip of bloque.ips) {
      const puertos = (ip.puertos ?? '').split(',').map((p) => parseInt(p.trim(), 10)).filter((p) => !Number.isNaN(p))
      const sensibles = puertos.filter((p) => PUERTOS_SENSIBLES.includes(p))
      if (sensibles.length) {
        hallazgosClave.push({ severidad: 'alta', titulo: 'Puertos sensibles expuestos', detalle: `La IP ${ip.ip} (${bloque.dominio}) expone puertos sensibles: ${sensibles.join(', ')}.` })
      }
      if (ip.cves && parseInt(ip.cves, 10) > 0) {
        hallazgosClave.push({ severidad: 'media', titulo: 'Vulnerabilidades conocidas', detalle: `La IP ${ip.ip} (${bloque.dominio}) tiene ${ip.cves} CVE conocidas según fuentes públicas.` })
      }
    }
    const provs = [...bloque.correo, ...bloque.dns, ...(bloque.registrador ? [bloque.registrador] : [])]
    if (provs.length) {
      hallazgosClave.push({ severidad: 'baja', titulo: 'Proveedores identificados', detalle: `${bloque.dominio} usa: ${provs.join(', ')}${bloque.saas.length ? ` y SaaS como ${bloque.saas.join(', ')}` : ''}.` })
    }
  }
  const totalCuentas = deTipo('cuenta').length
  if (totalCuentas >= 3) {
    hallazgosClave.push({ severidad: 'media', titulo: 'Huella digital amplia', detalle: `Se encontraron ${totalCuentas} perfiles en ${cuentasPorServicio.length} servicios distintos.` })
  }
  hallazgosClave.sort((a, b) => ORDEN_SEV[b.severidad] - ORDEN_SEV[a.severidad])

  // ----- Cronología (brechas + fechas whois) -----
  const cronologia: Evento[] = []
  for (const b of brechas) if (b.fecha) cronologia.push({ fecha: b.fecha, texto: `Filtración: ${b.nombre}` })
  for (const bloque of infraestructura) {
    if (bloque.registrado) cronologia.push({ fecha: bloque.registrado, texto: `Dominio ${bloque.dominio} registrado` })
    if (bloque.expira) cronologia.push({ fecha: bloque.expira, texto: `Caduca el registro de ${bloque.dominio}` })
  }
  cronologia.sort((a, b) => a.fecha.localeCompare(b.fecha))

  return {
    generadoEn: resultado.generadoEn,
    modo: resultado.modo,
    semillas: resultado.semillas,
    fuentes: resultado.fuentes,
    parcial: resultado.parcial,
    avisos: resultado.avisos,
    conteo,
    totalEntidades: entidades.length,
    identidades: identidades.sort((a, b) => ORDEN_CONF[b.confianza] - ORDEN_CONF[a.confianza]),
    exposicion: { emailsExpuestos, brechas },
    infraestructura,
    cuentasPorServicio,
    organizaciones,
    conexiones,
    hallazgosClave,
    cronologia,
  }
}

function etiquetaTipo(t: TipoEntidad): string {
  const m: Record<TipoEntidad, string> = {
    email: 'El correo',
    usuario: 'El usuario',
    dominio: 'El dominio',
    ip: 'La IP',
    cuenta: 'La cuenta',
    brecha: 'La filtración',
    persona: 'La persona',
    organizacion: 'La organización',
    telefono: 'El teléfono',
  }
  return m[t]
}
