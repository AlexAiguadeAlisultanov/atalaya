import { describe, it, expect } from 'vitest'
import { detectarTipo, semillaValida, normalizarValor } from '../src/engine/osint/normalizar'
import { construirVistaOsint } from '../src/engine/osint/disposicion'
import { osintSembrado, esCasoDemoOsint, CASOS_DEMO_OSINT } from '../src/datos/osint-sembrado'

describe('detectarTipo', () => {
  it('reconoce los tipos de semilla', () => {
    expect(detectarTipo('alex@ejemplo.es')).toBe('email')
    expect(detectarTipo('203.0.113.9')).toBe('ip')
    expect(detectarTipo('ejemplo.es')).toBe('dominio')
    expect(detectarTipo('alexrivera')).toBe('usuario')
    expect(detectarTipo('   ')).toBeNull()
  })
})

describe('semillaValida', () => {
  it('valida según el tipo', () => {
    expect(semillaValida('email', 'a@b.com')).toBe(true)
    expect(semillaValida('email', 'no-es-email')).toBe(false)
    expect(semillaValida('ip', '8.8.8.8')).toBe(true)
    expect(semillaValida('ip', '999.1.1.1')).toBe(true) // formato; el rango no se valida aquí
    expect(semillaValida('dominio', 'https://sub.ejemplo.es/ruta')).toBe(true)
    expect(semillaValida('usuario', 'ok_user-1')).toBe(true)
  })

  it('normaliza dominios quitando esquema y ruta', () => {
    expect(normalizarValor('dominio', 'HTTPS://Ejemplo.ES/algo')).toBe('ejemplo.es')
  })
})

describe('caso de demostración OSINT', () => {
  const r = osintSembrado('2026-01-01T00:00:00.000Z')

  it('se reconoce como demo y no está vacío', () => {
    expect(esCasoDemoOsint(CASOS_DEMO_OSINT[0] ? [CASOS_DEMO_OSINT[0].semilla] : [])).toBe(true)
    expect(r.grafo.entidades.length).toBeGreaterThan(10)
    expect(r.grafo.relaciones.length).toBeGreaterThan(10)
  })

  it('tiene exactamente una semilla y es el email', () => {
    const semillas = r.grafo.entidades.filter((e) => e.semilla)
    expect(semillas).toHaveLength(1)
    expect(semillas[0].tipo).toBe('email')
  })

  it('incluye entidades descubiertas de varios tipos', () => {
    const tipos = new Set(r.grafo.entidades.map((e) => e.tipo))
    for (const t of ['email', 'usuario', 'dominio', 'ip', 'cuenta', 'brecha', 'persona', 'organizacion']) {
      expect(tipos.has(t as never)).toBe(true)
    }
  })
})

describe('construirVistaOsint', () => {
  const grafo = osintSembrado('2026-01-01T00:00:00.000Z').grafo
  const vista = construirVistaOsint(grafo)

  it('crea un nodo por entidad', () => {
    expect(vista.nodos).toHaveLength(grafo.entidades.length)
  })

  it('todas las coordenadas caen en 0..1', () => {
    for (const n of vista.nodos) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.x).toBeLessThanOrEqual(1)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeLessThanOrEqual(1)
    }
  })

  it('la semilla única queda en el centro', () => {
    const semilla = vista.nodos.find((n) => n.semilla)!
    expect(semilla.x).toBeCloseTo(0.5)
    expect(semilla.y).toBeCloseTo(0.5)
    expect(semilla.capa).toBe(0)
  })

  it('cada arista conecta nodos existentes', () => {
    const ids = new Set(vista.nodos.map((n) => n.id))
    for (const a of vista.aristas) {
      expect(ids.has(a.desde)).toBe(true)
      expect(ids.has(a.hasta)).toBe(true)
    }
  })

  it('es determinista', () => {
    const otra = construirVistaOsint(osintSembrado('2026-01-01T00:00:00.000Z').grafo)
    expect(JSON.stringify(otra)).toBe(JSON.stringify(vista))
  })
})
