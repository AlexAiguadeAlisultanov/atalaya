// Utilidades de red del servidor: todas las llamadas a fuentes externas pasan por
// aquí, con tiempo de espera, cabecera de identificación honesta y manejo de
// errores. El navegador NUNCA llama a estas fuentes (CORS, límites, lentitud);
// siempre lo hace el servidor.

const UA = 'ATALAYA/0.1 (evaluacion de exposicion; recon pasivo; portfolio)'

export class ErrorFuente extends Error {
  constructor(
    public fuente: string,
    mensaje: string,
  ) {
    super(mensaje)
    this.name = 'ErrorFuente'
  }
}

async function pedir(
  url: string,
  opciones: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opciones.timeoutMs ?? 9000)
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, ...opciones.headers },
    })
  } finally {
    clearTimeout(t)
  }
}

export async function obtenerJson<T>(
  fuente: string,
  url: string,
  opciones: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<T> {
  let res: Response
  try {
    res = await pedir(url, { ...opciones, headers: { Accept: 'application/json', ...opciones.headers } })
  } catch (e) {
    throw new ErrorFuente(fuente, (e as Error).name === 'AbortError' ? 'tiempo de espera agotado' : (e as Error).message)
  }
  if (!res.ok) throw new ErrorFuente(fuente, `HTTP ${res.status}`)
  return (await res.json()) as T
}

export async function obtenerTexto(
  fuente: string,
  url: string,
  opciones: { timeoutMs?: number; headers?: Record<string, string> } = {},
): Promise<string> {
  let res: Response
  try {
    res = await pedir(url, opciones)
  } catch (e) {
    throw new ErrorFuente(fuente, (e as Error).name === 'AbortError' ? 'tiempo de espera agotado' : (e as Error).message)
  }
  if (!res.ok) throw new ErrorFuente(fuente, `HTTP ${res.status}`)
  return await res.text()
}

/** Aplica una función a una lista con concurrencia limitada (evita saturar las fuentes). */
export async function mapearConLimite<T, R>(
  items: T[],
  limite: number,
  fn: (item: T, indice: number) => Promise<R>,
): Promise<R[]> {
  const resultados: R[] = new Array(items.length)
  let siguiente = 0
  async function trabajador(): Promise<void> {
    while (siguiente < items.length) {
      const i = siguiente++
      resultados[i] = await fn(items[i], i)
    }
  }
  const trabajadores = Array.from({ length: Math.min(limite, items.length) }, () => trabajador())
  await Promise.all(trabajadores)
  return resultados
}

export function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
