// Límite diario de análisis EN VIVO por cliente. Los dominios de la lista blanca
// (datos sembrados) no gastan cuota; solo el análisis en vivo, que es el que
// consume fuentes externas. Protege el presupuesto de NVD y materializa la idea
// de "plan con límite diario" sin montar aún cuentas completas.

import { env } from 'node:process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

export const LIMITE_DIARIO = Number.parseInt(env.ATALAYA_LIMITE_DIARIO ?? '25', 10)

interface AlmacenUso {
  leer(cliente: string, fecha: string): number
  incrementar(cliente: string, fecha: string): number
}

function crear(): AlmacenUso {
  try {
    const { DatabaseSync } = require('node:sqlite') as typeof import('node:sqlite')
    const db = new DatabaseSync(env.ATALAYA_DB_PATH ?? 'atalaya.db')
    db.exec(
      'CREATE TABLE IF NOT EXISTS uso_diario (cliente TEXT, fecha TEXT, cantidad INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (cliente, fecha))',
    )
    const sel = db.prepare('SELECT cantidad FROM uso_diario WHERE cliente = ? AND fecha = ?')
    const up = db.prepare(
      'INSERT INTO uso_diario (cliente, fecha, cantidad) VALUES (?, ?, 1) ' +
        'ON CONFLICT(cliente, fecha) DO UPDATE SET cantidad = cantidad + 1',
    )
    return {
      leer: (c, f) => ((sel.get(c, f) as { cantidad: number } | undefined)?.cantidad ?? 0),
      incrementar: (c, f) => {
        up.run(c, f)
        return (sel.get(c, f) as { cantidad: number }).cantidad
      },
    }
  } catch {
    const mapa = new Map<string, number>()
    const k = (c: string, f: string) => `${c}|${f}`
    return {
      leer: (c, f) => mapa.get(k(c, f)) ?? 0,
      incrementar: (c, f) => {
        const n = (mapa.get(k(c, f)) ?? 0) + 1
        mapa.set(k(c, f), n)
        return n
      },
    }
  }
}

const almacen = crear()

export interface EstadoUso {
  usados: number
  restante: number
  limite: number
}

export function estadoUso(cliente: string, fecha: string): EstadoUso {
  const usados = almacen.leer(cliente, fecha)
  return { usados, restante: Math.max(0, LIMITE_DIARIO - usados), limite: LIMITE_DIARIO }
}

export function consumir(cliente: string, fecha: string): { permitido: boolean } & EstadoUso {
  const usados = almacen.leer(cliente, fecha)
  if (usados >= LIMITE_DIARIO) {
    return { permitido: false, usados, restante: 0, limite: LIMITE_DIARIO }
  }
  const nuevos = almacen.incrementar(cliente, fecha)
  return { permitido: true, usados: nuevos, restante: Math.max(0, LIMITE_DIARIO - nuevos), limite: LIMITE_DIARIO }
}
