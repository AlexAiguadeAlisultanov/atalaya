// Modelo del apartado OSINT de ATALAYA.
//
// La idea: el usuario mete varias "semillas" (un email, un usuario, un dominio,
// una IP) y el motor pivota por fuentes públicas y pasivas para descubrir datos
// relacionados (nombre, cuentas, brechas, subdominios, proveedores, organización).
// Todo acaba en un grafo de entidades conectadas, igual de explicable que el
// resto de ATALAYA: cada entidad dice de qué fuente salió.

export type TipoEntidad =
  | 'email'
  | 'usuario'
  | 'dominio'
  | 'ip'
  | 'cuenta' // un perfil en un servicio (GitHub, etc.)
  | 'brecha' // una filtración donde aparece un email
  | 'persona' // un nombre asociado
  | 'organizacion' // empresa, registrador, proveedor de correo/DNS/hosting
  | 'telefono'

/** Cómo de fiable es el dato según de dónde salió y cuántas fuentes lo respaldan. */
export type Confianza = 'alta' | 'media' | 'baja'

export interface Entidad {
  id: string // clave estable: `${tipo}:${valor normalizado}`
  tipo: TipoEntidad
  valor: string
  etiqueta: string // texto corto para pintar
  semilla: boolean // la metió el usuario
  fuentes: string[] // de qué fuentes salió ("gravatar", "github", "rdap"...)
  confianza: Confianza
  meta: Record<string, string> // datos extra para la ficha (ubicación, fechas, puertos...)
}

/** Relación dirigida entre dos entidades, con una etiqueta humana del vínculo. */
export interface Relacion {
  desde: string
  hasta: string
  tipo: string // "deriva", "perfil", "filtrado en", "resuelve a", "correo", "registra"...
}

export interface GrafoOsint {
  entidades: Entidad[]
  relaciones: Relacion[]
}

export interface ResultadoOsint {
  grafo: GrafoOsint
  semillas: Array<{ tipo: TipoEntidad; valor: string }>
  generadoEn: string
  modo: 'sembrado' | 'vivo'
  fuentes: string[] // qué fuentes respondieron en total
  parcial: boolean
  avisos: string[]
}

// ----- Vista del grafo (posiciones deterministas para que la UI solo dibuje) -----

export interface NodoOsint {
  id: string
  tipo: TipoEntidad
  etiqueta: string
  x: number // 0..1
  y: number // 0..1
  semilla: boolean
  capa: number // distancia (en saltos) a la semilla más cercana
}

export interface AristaOsint {
  desde: string
  hasta: string
  tipo: string
}

export interface VistaOsint {
  nodos: NodoOsint[]
  aristas: AristaOsint[]
}
