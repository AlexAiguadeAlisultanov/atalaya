// Disposición del grafo de superficie de ataque. Es lógica de dominio, no de UI:
// calcula posiciones DETERMINISTAS (0..1) para cada nodo a partir de la
// superficie, de modo que la interfaz solo tenga que dibujar y animar por scroll,
// sin repartir cálculos por los componentes. Mismo dato -> mismo mapa, siempre.

import type {
  AristaGrafo,
  GrafoVista,
  NodoGrafo,
  Severidad,
  SuperficieAtaque,
} from './tipos'
import { severidadDeCvss } from './score'

const ORDEN_SEV: Record<Severidad, number> = {
  critica: 4,
  alta: 3,
  media: 2,
  baja: 1,
  info: 0,
}

export function peorSeveridad(a: Severidad, b: Severidad): Severidad {
  return ORDEN_SEV[a] >= ORDEN_SEV[b] ? a : b
}

// Radios normalizados desde el centro del lienzo. Las CVE se empujan un poco más
// afuera y se abren en abanico más amplio que antes para que, cuando un activo
// arrastra varias, no se pisen ni los nodos ni sus etiquetas.
const R_SUB = 0.17
const R_ACTIVO = 0.33
const R_CVE = 0.46
// Separación angular entre CVE del mismo activo (radianes).
const PASO_CVE = 0.16

export function construirGrafo(superficie: SuperficieAtaque): GrafoVista {
  const nodos: NodoGrafo[] = []
  const aristas: AristaGrafo[] = []

  nodos.push({
    id: 'dom',
    tipo: 'dominio',
    etiqueta: superficie.dominio,
    x: 0.5,
    y: 0.5,
    severidad: 'info',
    kev: false,
    capa: 0,
  })

  // Índice rápido IP -> activo.
  const porIp = new Map(superficie.activos.map((a) => [a.ip, a]))

  const subs = superficie.subdominios
  const total = Math.max(subs.length, 1)

  subs.forEach((sub, i) => {
    // Repartimos los subdominios en círculo alrededor del dominio.
    const ang = (i / total) * Math.PI * 2 - Math.PI / 2
    const cos = Math.cos(ang)
    const sin = Math.sin(ang)

    const subId = `sub:${sub.nombre}`
    nodos.push({
      id: subId,
      tipo: 'subdominio',
      etiqueta: sub.nombre.replace(`.${superficie.dominio}`, ''),
      x: 0.5 + R_SUB * cos,
      y: 0.5 + R_SUB * sin,
      severidad: 'info',
      kev: false,
      capa: 1,
    })
    aristas.push({ desde: 'dom', hasta: subId })

    // Activo principal del subdominio (su primera IP conocida).
    const ipPrincipal = sub.ips[0]
    const activo = ipPrincipal ? porIp.get(ipPrincipal) : undefined
    if (!activo) return

    const activoId = `ip:${activo.ip}`
    let sevActivo: Severidad = 'info'
    let kevActivo = false
    for (const s of activo.servicios) {
      for (const c of s.cves) {
        sevActivo = peorSeveridad(sevActivo, severidadDeCvss(c.cvss))
        if (c.kev) kevActivo = true
      }
    }

    // Un activo puede colgar de varios subdominios; lo colocamos una sola vez.
    if (!nodos.some((n) => n.id === activoId)) {
      nodos.push({
        id: activoId,
        tipo: 'activo',
        etiqueta: activo.ip,
        x: 0.5 + R_ACTIVO * cos,
        y: 0.5 + R_ACTIVO * sin,
        severidad: sevActivo,
        kev: kevActivo,
        capa: 2,
      })

      // Nodos CVE del activo, abanicados un poco alrededor de su radio exterior.
      const cves = activo.servicios.flatMap((s) => s.cves)
      cves.forEach((cve, j) => {
        const desvio = (j - (cves.length - 1) / 2) * PASO_CVE
        const cveId = `cve:${activo.ip}:${cve.id}`
        nodos.push({
          id: cveId,
          tipo: 'cve',
          etiqueta: cve.id,
          x: 0.5 + R_CVE * Math.cos(ang + desvio),
          y: 0.5 + R_CVE * Math.sin(ang + desvio),
          severidad: severidadDeCvss(cve.cvss),
          kev: cve.kev,
          capa: 4,
        })
        aristas.push({ desde: activoId, hasta: cveId })
      })
    }

    aristas.push({ desde: subId, hasta: activoId })
  })

  return { nodos, aristas }
}
