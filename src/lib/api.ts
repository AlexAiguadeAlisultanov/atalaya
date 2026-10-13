// Cliente de la API de ATALAYA. El navegador nunca habla con las fuentes
// externas: siempre pasa por este servidor, que hace de proxy. En desarrollo
// Vite redirige /api a localhost:3099; en producción lo sirve el mismo Express.

import type { Analisis } from '../engine'
import type { FichaDominio } from '../datos/sembrado'

export interface Uso {
  usados: number
  restante: number
  limite: number
}

export interface Fuente {
  id: string
  nombre: string
  clave: boolean
}

export interface Estado {
  version: string
  base: string
  entradasCache: number
  nvdConClave: boolean
  limiteDiario: number
  uso: Uso
  fuentes: Fuente[]
}

export interface RespuestaAnalisis {
  analisis: Analisis
  avisos: string[]
  demo: boolean
  uso?: Uso
}

export type CodigoError =
  | 'dominio_invalido'
  | 'consentimiento_requerido'
  | 'limite_diario'
  | 'fuentes_no_disponibles'
  | 'red'
  | 'desconocido'

/** Error con la forma que devuelve la API, para que la UI decida qué decir. */
export class ErrorApi extends Error {
  codigo: CodigoError
  estado: number
  uso?: Uso

  constructor(codigo: CodigoError, mensaje: string, estado: number, uso?: Uso) {
    super(mensaje)
    this.name = 'ErrorApi'
    this.codigo = codigo
    this.estado = estado
    this.uso = uso
  }
}

async function leerJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    return null
  }
}

export async function obtenerDominiosDemo(): Promise<FichaDominio[]> {
  const res = await fetch('/api/dominios-demo')
  if (!res.ok) throw new ErrorApi('desconocido', 'No se pudo cargar la lista de dominios de demostración.', res.status)
  const datos = (await leerJson(res)) as { dominios?: FichaDominio[] } | null
  return datos?.dominios ?? []
}

export async function obtenerEstado(): Promise<Estado> {
  const res = await fetch('/api/estado')
  if (!res.ok) throw new ErrorApi('desconocido', 'No se pudo leer el estado del sistema.', res.status)
  return (await res.json()) as Estado
}

export async function obtenerUso(): Promise<Uso> {
  const res = await fetch('/api/uso')
  if (!res.ok) throw new ErrorApi('desconocido', 'No se pudo leer la cuota diaria.', res.status)
  return (await res.json()) as Uso
}

/**
 * Lanza un análisis. Los dominios de demostración vuelven al instante y sin
 * gastar cuota; un dominio propio exige consentimiento y gasta uno del día.
 */
export async function analizarDominio(
  dominio: string,
  consentimiento: boolean,
): Promise<RespuestaAnalisis> {
  let res: Response
  try {
    res = await fetch('/api/analizar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dominio, consentimiento }),
    })
  } catch {
    throw new ErrorApi('red', 'No hay conexión con el servidor de ATALAYA. Comprueba que la API está levantada.', 0)
  }

  if (res.ok) {
    return (await res.json()) as RespuestaAnalisis
  }

  const cuerpo = (await leerJson(res)) as { error?: CodigoError; mensaje?: string; uso?: Uso } | null
  const codigo = cuerpo?.error ?? 'desconocido'
  const mensaje = cuerpo?.mensaje ?? 'El análisis no se pudo completar.'
  throw new ErrorApi(codigo, mensaje, res.status, cuerpo?.uso)
}
