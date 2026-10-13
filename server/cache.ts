// Caché de respuestas de las fuentes externas. Dos motivos: respetar los límites
// de petición (sobre todo NVD, 5 peticiones/30s sin clave) y que la demo vaya
// rápida. Usa node:sqlite (incluido en Node, sin instalar nada); si no estuviera
// disponible, cae a una caché en memoria para no romper nunca.

import { env } from 'node:process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

interface Almacen {
  obtener(clave: string): string | undefined
  guardar(clave: string, valor: string, ttlSeg: number): void
  cuenta(): number
}

function ahora(): number {
  return Date.now()
}

function crearAlmacen(): { almacen: Almacen; backend: 'sqlite' | 'memoria' } {
  try {
    // Import síncrono mediante createRequire para poder hacer fallback si falla.
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
    const ruta = env.ATALAYA_DB_PATH ?? 'atalaya.db'
    const db = new DatabaseSync(ruta)
    db.exec('CREATE TABLE IF NOT EXISTS cache (clave TEXT PRIMARY KEY, valor TEXT NOT NULL, expira INTEGER NOT NULL)')
    const leer = db.prepare('SELECT valor, expira FROM cache WHERE clave = ?')
    const escribir = db.prepare('INSERT OR REPLACE INTO cache (clave, valor, expira) VALUES (?, ?, ?)')
    const borrar = db.prepare('DELETE FROM cache WHERE clave = ?')
    const contar = db.prepare('SELECT COUNT(*) AS c FROM cache')
    return {
      backend: 'sqlite',
      almacen: {
        obtener(clave) {
          const fila = leer.get(clave) as { valor: string; expira: number } | undefined
          if (!fila) return undefined
          if (fila.expira < ahora()) {
            borrar.run(clave)
            return undefined
          }
          return fila.valor
        },
        guardar(clave, valor, ttlSeg) {
          escribir.run(clave, valor, ahora() + ttlSeg * 1000)
        },
        cuenta() {
          return (contar.get() as { c: number }).c
        },
      },
    }
  } catch {
    const mapa = new Map<string, { valor: string; expira: number }>()
    return {
      backend: 'memoria',
      almacen: {
        obtener(clave) {
          const e = mapa.get(clave)
          if (!e) return undefined
          if (e.expira < ahora()) {
            mapa.delete(clave)
            return undefined
          }
          return e.valor
        },
        guardar(clave, valor, ttlSeg) {
          mapa.set(clave, { valor, expira: ahora() + ttlSeg * 1000 })
        },
        cuenta() {
          return mapa.size
        },
      },
    }
  }
}

const { almacen, backend } = crearAlmacen()

export const BACKEND_CACHE = backend

/** Lee de caché y, si no está o caducó, calcula, guarda y devuelve. */
export async function conCache<T>(clave: string, ttlSeg: number, calcular: () => Promise<T>): Promise<T> {
  const guardado = almacen.obtener(clave)
  if (guardado !== undefined) return JSON.parse(guardado) as T
  const valor = await calcular()
  almacen.guardar(clave, JSON.stringify(valor), ttlSeg)
  return valor
}

export function cacheObtener<T>(clave: string): T | undefined {
  const g = almacen.obtener(clave)
  return g === undefined ? undefined : (JSON.parse(g) as T)
}

export function cacheGuardar(clave: string, valor: unknown, ttlSeg: number): void {
  almacen.guardar(clave, JSON.stringify(valor), ttlSeg)
}

export function cacheCuenta(): number {
  return almacen.cuenta()
}
