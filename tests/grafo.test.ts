import { describe, it, expect } from 'vitest'
import { construirGrafo } from '../src/engine/grafo'
import { superficieSembrada } from '../src/datos/sembrado'

describe('construirGrafo', () => {
  const superficie = superficieSembrada('banco-ejemplo.es')!
  const grafo = construirGrafo(superficie)

  it('tiene un único nodo dominio en el centro', () => {
    const dom = grafo.nodos.filter((n) => n.tipo === 'dominio')
    expect(dom).toHaveLength(1)
    expect(dom[0].x).toBeCloseTo(0.5)
    expect(dom[0].y).toBeCloseTo(0.5)
  })

  it('crea un nodo subdominio por cada subdominio', () => {
    const subs = grafo.nodos.filter((n) => n.tipo === 'subdominio')
    expect(subs).toHaveLength(superficie.subdominios.length)
  })

  it('todas las coordenadas caen dentro del lienzo 0..1', () => {
    for (const n of grafo.nodos) {
      expect(n.x).toBeGreaterThanOrEqual(0)
      expect(n.x).toBeLessThanOrEqual(1)
      expect(n.y).toBeGreaterThanOrEqual(0)
      expect(n.y).toBeLessThanOrEqual(1)
    }
  })

  it('cada arista conecta nodos que existen', () => {
    const ids = new Set(grafo.nodos.map((n) => n.id))
    for (const a of grafo.aristas) {
      expect(ids.has(a.desde)).toBe(true)
      expect(ids.has(a.hasta)).toBe(true)
    }
  })

  it('es determinista', () => {
    const otro = construirGrafo(superficieSembrada('banco-ejemplo.es')!)
    expect(JSON.stringify(otro)).toBe(JSON.stringify(grafo))
  })
})
