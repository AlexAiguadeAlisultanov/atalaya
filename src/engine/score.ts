// El cálculo de riesgo de ATALAYA. Determinista y explicable: cada número lleva
// detrás un "porqué" en voz humana para que el informe no sea una caja negra.
//
// La idea central del producto: NO priorizamos por CVSS a secas. Un CVE "crítico"
// que nadie explota importa menos que uno "alto" que ya se está usando en ataques
// reales. Por eso cada hallazgo mezcla gravedad (CVSS), probabilidad real de
// explotación (EPSS), si está en el catálogo KEV de CISA, lo sensible que es el
// puerto y lo crítico que es el activo.

import type {
  Analisis,
  DesgloseExposicion,
  Exposicion,
  Hallazgo,
  NivelExposicion,
  Severidad,
  SuperficieAtaque,
} from './tipos'
import { criticidadHost, esPuertoSensible, motivoPuerto } from './puertos'

export function limitar(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x
}

/** Banda de gravedad a partir de la puntuación base CVSS (rangos estándar). */
export function severidadDeCvss(cvss: number): Severidad {
  if (cvss >= 9) return 'critica'
  if (cvss >= 7) return 'alta'
  if (cvss >= 4) return 'media'
  if (cvss >= 0.1) return 'baja'
  return 'info'
}

export function nivelDeScore(score: number): NivelExposicion {
  if (score >= 80) return 'critico'
  if (score >= 60) return 'alto'
  if (score >= 35) return 'medio'
  return 'bajo'
}

/**
 * Puntuación de riesgo de un hallazgo (0..100) y las razones de por qué sube.
 * Fórmula documentada:
 *   base (CVSS*5.5, hasta 55) + EPSS (hasta 20) + KEV (15) + puerto sensible (6) + criticidad del host (hasta 8)
 * acotado a 0..100. Solo el peor caso absoluto llega a 100, para que el top tenga matiz.
 */
export function puntuacionRiesgo(entrada: {
  cvss: number
  epss: number
  kev: boolean
  kevPlazo?: string
  puerto: number
  host: string
}): { valor: number; razones: string[] } {
  const razones: string[] = []

  const base = entrada.cvss * 5.5
  const sev = severidadDeCvss(entrada.cvss)
  razones.push(`Gravedad CVSS ${entrada.cvss.toFixed(1)} (${sev})`)

  const epssBoost = entrada.epss * 20
  if (entrada.epss >= 0.5) {
    razones.push(`Alta probabilidad de explotación: EPSS ${Math.round(entrada.epss * 100)}%`)
  } else if (entrada.epss >= 0.1) {
    razones.push(`Probabilidad de explotación moderada: EPSS ${Math.round(entrada.epss * 100)}%`)
  }

  const kevBoost = entrada.kev ? 15 : 0
  if (entrada.kev) {
    razones.push(
      entrada.kevPlazo
        ? `Explotada de verdad hoy (catálogo KEV de CISA, plazo ${entrada.kevPlazo})`
        : 'Explotada de verdad hoy (catálogo KEV de CISA)',
    )
  }

  const puertoBoost = esPuertoSensible(entrada.puerto) ? 6 : 0
  const motivo = motivoPuerto(entrada.puerto)
  if (motivo) razones.push(motivo)

  const crit = criticidadHost(entrada.host)
  const hostBoost = crit.peso * 8
  if (crit.etiqueta) razones.push(`Afecta a un activo sensible: ${crit.etiqueta}`)

  const valor = Math.round(limitar(base + epssBoost + kevBoost + puertoBoost + hostBoost, 0, 100))
  return { valor, razones }
}

/** Aplana todos los CVE de la superficie en hallazgos con su contexto. */
export function construirHallazgos(superficie: SuperficieAtaque): Hallazgo[] {
  const hallazgos: Hallazgo[] = []
  for (const activo of superficie.activos) {
    const host = activo.hosts[0] ?? activo.ip
    for (const servicio of activo.servicios) {
      for (const cve of servicio.cves) {
        const { valor, razones } = puntuacionRiesgo({
          cvss: cve.cvss,
          epss: cve.epss,
          kev: cve.kev,
          kevPlazo: cve.kevPlazo,
          puerto: servicio.puerto,
          host,
        })
        hallazgos.push({
          cve: cve.id,
          ip: activo.ip,
          host,
          servicio: `${servicio.nombre}:${servicio.puerto}`,
          severidad: severidadDeCvss(cve.cvss),
          cvss: cve.cvss,
          epss: cve.epss,
          kev: cve.kev,
          kevPlazo: cve.kevPlazo,
          puntuacionRiesgo: valor,
          razones,
        })
      }
    }
  }
  return hallazgos
}

/**
 * Ordena los hallazgos por prioridad real. Orden total y estable: a igual
 * puntuación, primero KEV, luego EPSS, luego CVSS y por último el id del CVE,
 * para que el resultado sea idéntico en cada ejecución.
 */
export function priorizar(hallazgos: Hallazgo[]): Hallazgo[] {
  return [...hallazgos].sort((a, b) => {
    if (b.puntuacionRiesgo !== a.puntuacionRiesgo) return b.puntuacionRiesgo - a.puntuacionRiesgo
    if (a.kev !== b.kev) return a.kev ? -1 : 1
    if (b.epss !== a.epss) return b.epss - a.epss
    if (b.cvss !== a.cvss) return b.cvss - a.cvss
    return a.cve < b.cve ? -1 : a.cve > b.cve ? 1 : 0
  })
}

export function calcularDesglose(superficie: SuperficieAtaque): DesgloseExposicion {
  let serviciosExpuestos = 0
  let cvesTotal = 0
  let cvesKev = 0
  let certificadosPorCaducar = 0
  let puertosSensibles = 0

  for (const activo of superficie.activos) {
    if (
      activo.certificadoCaducaEnDias !== undefined &&
      activo.certificadoCaducaEnDias <= 30
    ) {
      certificadosPorCaducar++
    }
    for (const servicio of activo.servicios) {
      serviciosExpuestos++
      if (esPuertoSensible(servicio.puerto)) puertosSensibles++
      for (const cve of servicio.cves) {
        cvesTotal++
        if (cve.kev) cvesKev++
      }
    }
  }

  return { serviciosExpuestos, cvesTotal, cvesKev, certificadosPorCaducar, puertosSensibles }
}

/**
 * Score global de exposición 0..100. "OR ruidoso" con amortiguación: el peor
 * hallazgo marca el suelo y el resto suma con peso decreciente. Así una sola
 * vulnerabilidad crítica y explotada ya dispara el número, y acumular muchos
 * problemas medianos también, pero sin que diez CVE leves saturen a 100.
 */
export function calcularExposicion(superficie: SuperficieAtaque): Exposicion {
  const hallazgos = priorizar(construirHallazgos(superficie))
  const desglose = calcularDesglose(superficie)

  let score = 0
  if (hallazgos.length > 0) {
    const riesgos = hallazgos.map((h) => h.puntuacionRiesgo / 100)
    const rMax = riesgos[0]
    let acum = 1
    for (let i = 1; i < riesgos.length; i++) {
      acum *= 1 - 0.5 * riesgos[i]
    }
    const score01 = rMax + (1 - rMax) * (1 - acum)
    score = Math.round(limitar(score01, 0, 1) * 100)
  }

  return { score, nivel: nivelDeScore(score), desglose, top: hallazgos }
}

/** Punto de entrada del motor: de una fotografía cruda al análisis completo. */
export function analizar(superficie: SuperficieAtaque): Analisis {
  return { superficie, exposicion: calcularExposicion(superficie) }
}
