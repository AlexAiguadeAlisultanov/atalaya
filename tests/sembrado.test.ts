import { describe, it, expect } from 'vitest'
import { analizar } from '../src/engine/score'
import { DOMINIOS_DEMO, esDominioDemo, superficieSembrada } from '../src/datos/sembrado'

describe('datos sembrados', () => {
  it('cada dominio de la lista blanca tiene superficie y se reconoce', () => {
    for (const d of DOMINIOS_DEMO) {
      expect(esDominioDemo(d.dominio)).toBe(true)
      expect(superficieSembrada(d.dominio)).toBeDefined()
    }
  })

  it('un dominio fuera de la lista no es demo', () => {
    expect(esDominioDemo('no-existe-xyz.com')).toBe(false)
    expect(superficieSembrada('no-existe-xyz.com')).toBeUndefined()
  })

  it('cada dominio demo se analiza y produce un score válido', () => {
    for (const d of DOMINIOS_DEMO) {
      const { exposicion } = analizar(superficieSembrada(d.dominio)!)
      expect(exposicion.score).toBeGreaterThan(0)
      expect(exposicion.score).toBeLessThanOrEqual(100)
      expect(exposicion.top.length).toBeGreaterThan(0)
    }
  })

  it('el desglose KEV coincide con los hallazgos marcados como KEV', () => {
    const { exposicion } = analizar(superficieSembrada('banco-ejemplo.es')!)
    const kevEnTop = exposicion.top.filter((h) => h.kev).length
    expect(exposicion.desglose.cvesKev).toBe(kevEnTop)
  })

  it('superficieSembrada devuelve copias independientes (no muta el original)', () => {
    const a = superficieSembrada('banco-ejemplo.es')!
    a.activos[0].servicios = []
    const b = superficieSembrada('banco-ejemplo.es')!
    expect(b.activos[0].servicios.length).toBeGreaterThan(0)
  })
})
