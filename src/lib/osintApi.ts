// Cliente del apartado OSINT. El navegador nunca habla con las fuentes públicas:
// pasa por el servidor de ATALAYA, que hace de proxy. En desarrollo Vite redirige
// /api a localhost:3099. El caso de demostración vuelve al instante y no gasta
// cuota; una investigación en vivo exige consentimiento y gasta uno de la cuota
// diaria, la misma que el análisis de superficie.

import type { CasoDemoOsint } from '../datos/osint-sembrado'
import type { ResultadoOsint, TipoEntidad } from '../engine/osint/tipos'

export interface UsoOsint {
  usados: number
  restante: number
  limite: number
}

export interface SemillaOsint {
  tipo: TipoEntidad
  valor: string
}

export interface RespuestaOsint {
  resultado: ResultadoOsint
  demo: boolean
  uso?: UsoOsint
}

export type CodigoErrorOsint =
  | 'semillas_requeridas'
  | 'semillas_invalidas'
  | 'consentimiento_requerido'
  | 'limite_diario'
  | 'fuentes_no_disponibles'
  | 'red'
  | 'desconocido'

/** Error con la forma que devuelve la API, para que la interfaz decida qué decir. */
export class ErrorOsint extends Error {
  codigo: CodigoErrorOsint
  estado: number
  uso?: UsoOsint

  constructor(codigo: CodigoErrorOsint, mensaje: string, estado: number, uso?: UsoOsint) {
    super(mensaje)
    this.name = 'ErrorOsint'
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

export async function obtenerCasosDemoOsint(): Promise<CasoDemoOsint[]> {
  const res = await fetch('/api/osint/demo')
  if (!res.ok) {
    throw new ErrorOsint('desconocido', 'No se pudo cargar el caso de demostración.', res.status)
  }
  const datos = (await leerJson(res)) as { casos?: CasoDemoOsint[] } | null
  return datos?.casos ?? []
}

/**
 * Lanza una investigación. El caso de demostración (el email de ejemplo) vuelve
 * al instante y sin gastar cuota; cualquier otra semilla exige consentimiento y
 * gasta una de la cuota del día.
 */
export async function investigar(
  semillas: SemillaOsint[],
  consentimiento: boolean,
): Promise<RespuestaOsint> {
  let res: Response
  try {
    res = await fetch('/api/osint', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ semillas, consentimiento }),
    })
  } catch {
    throw new ErrorOsint(
      'red',
      'No hay conexión con el servidor de ATALAYA. Comprueba que la API está levantada.',
      0,
    )
  }

  if (res.ok) {
    return (await res.json()) as RespuestaOsint
  }

  const cuerpo = (await leerJson(res)) as { error?: CodigoErrorOsint; mensaje?: string; uso?: UsoOsint } | null
  const codigo = cuerpo?.error ?? 'desconocido'
  const mensaje = cuerpo?.mensaje ?? 'La investigación no se pudo completar.'
  throw new ErrorOsint(codigo, mensaje, res.status, cuerpo?.uso)
}
