// Orquestador del análisis EN VIVO: de un dominio a una SuperficieAtaque real,
// usando solo fuentes pasivas. Luego el motor (compartido con el front) calcula
// la exposición. Todo el riesgo de las fuentes (lentitud, límites, caídas) queda
// aislado aquí: caps de tamaño, concurrencia limitada y degradación elegante.

import { env } from 'node:process'
import type { Activo, Analisis, Cve, Servicio, Subdominio, SuperficieAtaque } from '../src/engine/tipos'
import { analizar as analizarMotor } from '../src/engine/score'
import { superficieSembrada } from '../src/datos/sembrado'
import { mapearConLimite } from './http'
import { subdominiosDeCrtsh } from './fuentes/crtsh'
import { hostsearch } from './fuentes/hackertarget'
import { resolverA } from './fuentes/dns'
import { infoDeIp } from './fuentes/internetdb'
import { mapaKev } from './fuentes/kev'
import { enriquecerCve } from './fuentes/cvedb'
import type { EnriquecimientoCve } from './fuentes/cvedb'
import { datosDeCve } from './fuentes/nvd'

const MAX_SUBDOMINIOS = 40
const MAX_IPS = 25
const MAX_CVES = 40

const NOMBRE_PUERTO: Record<number, string> = {
  21: 'ftp', 22: 'ssh', 23: 'telnet', 25: 'smtp', 53: 'dns', 80: 'http',
  110: 'pop3', 143: 'imap', 443: 'https', 445: 'smb', 465: 'smtps', 587: 'smtp',
  993: 'imaps', 995: 'pop3s', 1433: 'mssql', 3306: 'mysql', 3389: 'rdp',
  5432: 'postgresql', 5900: 'vnc', 6379: 'redis', 8080: 'http-alt', 8443: 'https-alt',
  9200: 'elasticsearch', 27017: 'mongodb',
}

// Puertos que, si están abiertos, preferimos para "colgar" las CVE del host, para
// no infravalorar el riesgo (InternetDB da las CVE a nivel de IP, no de puerto).
const PRIORIDAD_PUERTO = [3389, 445, 22, 23, 3306, 5432, 1433, 6379, 27017, 443, 80]

function nombrePuerto(p: number): string {
  return NOMBRE_PUERTO[p] ?? `tcp/${p}`
}

function puertoPrincipal(ports: number[]): number {
  for (const p of PRIORIDAD_PUERTO) if (ports.includes(p)) return p
  return ports[0] ?? 0
}

export interface ResultadoVivo {
  analisis: Analisis
  avisos: string[]
}

/** Análisis de un dominio de la lista blanca: datos sembrados, instantáneo. */
export function analizarSembrado(dominio: string, fechaIso: string): Analisis {
  const superficie = superficieSembrada(dominio)!
  superficie.generadoEn = fechaIso // el servidor marca cuándo se sirvió
  return analizarMotor(superficie)
}

/** Análisis en vivo contra las fuentes pasivas reales. */
export async function analizarVivo(dominio: string, fechaIso: string): Promise<ResultadoVivo> {
  const avisos: string[] = []
  const fuentes = new Set<string>()
  let parcial = false

  // 1) Descubrimiento de subdominios en paralelo: crt.sh y hackertarget. Cada uno
  //    cubre al otro si cae. hackertarget además trae la IP ya resuelta (hint).
  const [resCrt, resHt] = await Promise.allSettled([
    subdominiosDeCrtsh(dominio, MAX_SUBDOMINIOS),
    hostsearch(dominio, 80),
  ])
  const nombres = new Set<string>()
  const hints = new Map<string, Set<string>>()
  if (resCrt.status === 'fulfilled') {
    fuentes.add('crtsh')
    for (const n of resCrt.value) nombres.add(n)
  }
  if (resHt.status === 'fulfilled' && resHt.value.length > 0) {
    fuentes.add('hackertarget')
    for (const { host, ip } of resHt.value) {
      nombres.add(host)
      if (!hints.has(host)) hints.set(host, new Set())
      hints.get(host)!.add(ip)
    }
  }
  const sinSubdominios = resCrt.status === 'rejected' && (resHt.status === 'rejected' || resHt.value.length === 0)
  if (sinSubdominios) {
    parcial = true
    avisos.push('Las fuentes de subdominios no respondieron; se analiza solo el dominio raíz.')
  }
  nombres.add(dominio)
  nombres.add(`www.${dominio}`)
  const listaSubs = [...nombres].slice(0, MAX_SUBDOMINIOS)

  // 2) Resolución a IPs: unimos el hint de hackertarget con el DNS (DoH).
  const resueltos = await mapearConLimite(listaSubs, 6, async (nombre) => {
    const hint = hints.get(nombre)
    const porDns = await resolverA(nombre)
    const ips = [...new Set([...(hint ?? []), ...porDns])]
    return { nombre, ips }
  })
  if (resueltos.some((r) => r.ips.length > 0)) fuentes.add('dns')

  const subdominios: Subdominio[] = resueltos
    .filter((r) => r.ips.length > 0)
    .map((r) => ({ nombre: r.nombre, ips: r.ips, origen: ['crtsh', 'dns'] }))

  const ipsUnicas = [...new Set(subdominios.flatMap((s) => s.ips))].slice(0, MAX_IPS)

  // 3) Puertos/servicios/CVE por IP (Shodan InternetDB).
  const infos = await mapearConLimite(ipsUnicas, 8, async (ip) => {
    try {
      const info = await infoDeIp(ip)
      fuentes.add('internetdb')
      return info
    } catch {
      parcial = true
      return { ip, ports: [], cpes: [], vulns: [], hostnames: [] }
    }
  })

  // 4) Enriquecimiento de CVE: CVSS + EPSS + KEV (Shodan CVEDB) y plazos (CISA KEV).
  const todosLosCve = [...new Set(infos.flatMap((i) => i.vulns.map((v) => v.toUpperCase())))]
  const idsCve = todosLosCve.slice(0, MAX_CVES)
  if (todosLosCve.length > MAX_CVES) {
    avisos.push(`Se detectaron ${todosLosCve.length} CVE; se enriquecieron y priorizaron las primeras ${MAX_CVES}.`)
  }

  // Plazo de remediación de CISA para los KEV (una llamada cacheada; el plazo es
  // lo único que CVEDB no da, así que lo sacamos del feed KEV).
  let plazosKev: Record<string, string> = {}
  if (idsCve.length) {
    try {
      plazosKev = await mapaKev()
      fuentes.add('kev')
    } catch {
      // El plazo es opcional; su ausencia no invalida el análisis.
    }
  }

  // Enriquecimiento CVSS + EPSS + KEV por CVE con Shodan CVEDB: rápido, sin clave y
  // sin el límite de NVD. Si hay clave de NVD, afinamos el CVSS con la fuente
  // autoritativa después.
  const enriquecido = new Map<string, EnriquecimientoCve>()
  if (idsCve.length) {
    await mapearConLimite(idsCve, 8, async (id) => {
      enriquecido.set(id, await enriquecerCve(id))
    })
    fuentes.add('cvedb')

    if (env.ATALAYA_NVD_KEY) {
      await mapearConLimite(idsCve, 4, async (id) => {
        const d = await datosDeCve(id)
        const actual = enriquecido.get(id)!
        if (d.cvss > 0) enriquecido.set(id, { ...actual, cvss: d.cvss, descripcion: d.descripcion ?? actual.descripcion })
      })
      fuentes.add('nvd')
    }
  }

  function construirCve(id: string): Cve {
    const up = id.toUpperCase()
    const e = enriquecido.get(up) ?? { cvss: 0, epss: 0, kev: false }
    const plazo = plazosKev[up]
    return {
      id: up,
      cvss: e.cvss,
      epss: e.epss,
      kev: e.kev,
      kevPlazo: e.kev && plazo ? plazo : undefined,
      descripcion: e.descripcion,
    }
  }

  // 5) Montamos los activos.
  const activos: Activo[] = infos.map((info) => {
    const hosts = subdominios.filter((s) => s.ips.includes(info.ip)).map((s) => s.nombre)
    const servicios: Servicio[] = info.ports.map((p) => ({
      puerto: p,
      protocolo: 'tcp',
      nombre: nombrePuerto(p),
      cpe: info.cpes[0],
      cves: [],
    }))
    // Colgamos las CVE del host en su puerto más sensible (granularidad de InternetDB).
    const cves = info.vulns.map(construirCve)
    if (cves.length) {
      const principal = puertoPrincipal(info.ports)
      let destino = servicios.find((s) => s.puerto === principal)
      if (!destino) {
        destino = { puerto: principal, protocolo: 'tcp', nombre: nombrePuerto(principal), cves: [] }
        servicios.push(destino)
      }
      destino.cves = cves
    }
    return {
      ip: info.ip,
      tipo: 'ipv4',
      hosts: hosts.length ? hosts : [info.ip],
      servicios,
    }
  })

  const superficie: SuperficieAtaque = {
    dominio,
    generadoEn: fechaIso,
    modo: 'vivo',
    parcial,
    fuentes: [...fuentes],
    subdominios,
    activos,
  }

  return { analisis: analizarMotor(superficie), avisos }
}
