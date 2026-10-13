// Modelo de dominio de ATALAYA.
//
// Una sola fuente de verdad: todo lo que la interfaz dibuja (grafo, cockpit,
// ficha de activo, informe) sale de estas estructuras. El motor no sabe nada
// de React ni del DOM; recibe una SuperficieAtaque cruda y devuelve un Analisis
// calculado de forma determinista (mismos datos -> mismo resultado).

export type Severidad = 'critica' | 'alta' | 'media' | 'baja' | 'info'

export type NivelExposicion = 'critico' | 'alto' | 'medio' | 'bajo'

/** Una vulnerabilidad concreta (CVE) asociada a un servicio. */
export interface Cve {
  id: string // p. ej. "CVE-2024-3400"
  cvss: number // puntuación base CVSS 0..10
  epss: number // probabilidad de explotación 0..1 (modelo EPSS de FIRST)
  kev: boolean // en el catálogo KEV de CISA (explotado de verdad hoy)
  kevPlazo?: string // fecha límite de remediación que marca CISA (ISO)
  descripcion?: string
}

/** Un servicio expuesto en un puerto de un activo. */
export interface Servicio {
  puerto: number
  protocolo: 'tcp' | 'udp'
  nombre: string // "https", "ssh", "ftp"...
  producto?: string // "Apache httpd"
  version?: string // "2.4.49"
  cpe?: string // identificador CPE del producto
  cves: Cve[]
}

/** Un activo: una IP pública con sus servicios y los nombres que resuelven a ella. */
export interface Activo {
  ip: string
  tipo: 'ipv4' | 'ipv6'
  hosts: string[] // subdominios que resuelven a esta IP
  servicios: Servicio[]
  certificadoCaducaEnDias?: number // negativo = ya caducado
  pais?: string
  organizacion?: string
}

/** Un subdominio descubierto y las IPs a las que resuelve. */
export interface Subdominio {
  nombre: string // "vpn.empresa.es"
  ips: string[]
  origen: Array<'crtsh' | 'dns'>
}

/** Fotografía cruda de lo que una organización expone a internet. */
export interface SuperficieAtaque {
  dominio: string
  generadoEn: string // marca de tiempo puesta por el servidor (ISO)
  subdominios: Subdominio[]
  activos: Activo[]
  fuentes: string[] // qué fuentes respondieron ("crtsh", "dns", "internetdb"...)
  parcial: boolean // true si alguna fuente falló y el retrato es incompleto
  modo: 'sembrado' | 'vivo' // de dónde salieron los datos
}

/** Un hallazgo priorizado: un CVE con su contexto y su puntuación de riesgo. */
export interface Hallazgo {
  cve: string
  ip: string
  host: string
  servicio: string // "https:443"
  severidad: Severidad
  cvss: number
  epss: number
  kev: boolean
  kevPlazo?: string
  puntuacionRiesgo: number // 0..100, prioridad real (no CVSS a secas)
  razones: string[] // por qué sube (voz humana, para el informe)
}

export interface DesgloseExposicion {
  serviciosExpuestos: number
  cvesTotal: number
  cvesKev: number
  certificadosPorCaducar: number
  puertosSensibles: number
}

export interface Exposicion {
  score: number // 0..100
  nivel: NivelExposicion
  desglose: DesgloseExposicion
  top: Hallazgo[] // todos los hallazgos, ya ordenados por prioridad
}

/** Resultado completo de un análisis: la fotografía + lo calculado sobre ella. */
export interface Analisis {
  superficie: SuperficieAtaque
  exposicion: Exposicion
}

// ----- Vista de grafo (posiciones deterministas para que la UI solo dibuje) -----

export type TipoNodo = 'dominio' | 'subdominio' | 'activo' | 'servicio' | 'cve'

export interface NodoGrafo {
  id: string
  tipo: TipoNodo
  etiqueta: string
  x: number // 0..1 dentro del lienzo
  y: number // 0..1
  severidad: Severidad
  kev: boolean
  capa: number // 0 dominio, 1 subdominio, 2 activo, 3 servicio, 4 cve
}

export interface AristaGrafo {
  desde: string
  hasta: string
}

export interface GrafoVista {
  nodos: NodoGrafo[]
  aristas: AristaGrafo[]
}
