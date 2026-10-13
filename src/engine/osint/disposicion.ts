// Disposición determinista del grafo de entidades OSINT. Las semillas van al
// centro y lo descubierto se abre en anillos por saltos (BFS), agrupando cada
// nodo cerca de su "padre" para que se lea el pivoteo. Pura: mismo grafo ->
// mismo mapa, siempre. La interfaz solo dibuja.

import type { GrafoOsint, NodoOsint, VistaOsint } from './tipos'

const RADIOS = [0, 0.26, 0.41, 0.47, 0.49]
const radioDe = (c: number) => (c >= RADIOS.length ? 0.49 : RADIOS[c])

export function construirVistaOsint(grafo: GrafoOsint): VistaOsint {
  const ids = new Set(grafo.entidades.map((e) => e.id))
  const porEnt = new Map(grafo.entidades.map((e) => [e.id, e]))

  // Adyacencia no dirigida.
  const adj = new Map<string, string[]>()
  for (const e of grafo.entidades) adj.set(e.id, [])
  for (const r of grafo.relaciones) {
    if (ids.has(r.desde) && ids.has(r.hasta)) {
      adj.get(r.desde)!.push(r.hasta)
      adj.get(r.hasta)!.push(r.desde)
    }
  }

  // BFS de capas desde las semillas (o la primera entidad si no hay semillas).
  const capa = new Map<string, number>()
  const padre = new Map<string, string>()
  const cola: string[] = []
  for (const e of grafo.entidades) {
    if (e.semilla) {
      capa.set(e.id, 0)
      cola.push(e.id)
    }
  }
  if (cola.length === 0 && grafo.entidades[0]) {
    capa.set(grafo.entidades[0].id, 0)
    cola.push(grafo.entidades[0].id)
  }
  while (cola.length) {
    const u = cola.shift()!
    for (const v of adj.get(u) ?? []) {
      if (!capa.has(v)) {
        capa.set(v, capa.get(u)! + 1)
        padre.set(v, u)
        cola.push(v)
      }
    }
  }

  const porCapa = new Map<number, string[]>()
  for (const e of grafo.entidades) {
    const c = capa.get(e.id) ?? 99
    if (!porCapa.has(c)) porCapa.set(c, [])
    porCapa.get(c)!.push(e.id)
  }

  const angulo = new Map<string, number>()
  const nodos: NodoOsint[] = []

  // Capa 0 (semillas): una en el centro; varias en un círculo pequeño.
  const capa0 = porCapa.get(0) ?? []
  capa0.forEach((id, i) => {
    const e = porEnt.get(id)!
    let x = 0.5
    let y = 0.5
    if (capa0.length > 1) {
      const a = (i / capa0.length) * Math.PI * 2 - Math.PI / 2
      angulo.set(id, a)
      x = 0.5 + 0.09 * Math.cos(a)
      y = 0.5 + 0.09 * Math.sin(a)
    } else {
      angulo.set(id, -Math.PI / 2)
    }
    nodos.push({ id, tipo: e.tipo, etiqueta: e.etiqueta, x, y, semilla: e.semilla, capa: 0 })
  })

  const colocar = (id: string, c: number, a: number) => {
    const r = radioDe(c)
    const e = porEnt.get(id)!
    angulo.set(id, a)
    nodos.push({
      id,
      tipo: e.tipo,
      etiqueta: e.etiqueta,
      x: 0.5 + r * Math.cos(a),
      y: 0.5 + r * Math.sin(a),
      semilla: e.semilla,
      capa: c,
    })
  }

  const capas = [...porCapa.keys()]
  const maxCapa = capas.length ? Math.max(...capas) : 0
  const semillaCentralUnica = capa0.length === 1

  for (let c = 1; c <= maxCapa; c++) {
    const lista = porCapa.get(c) ?? []

    // La capa 1 de una única semilla central se reparte por TODO el círculo, para
    // que no se amontone hacia un lado (todo cuelga de la misma semilla).
    if (c === 1 && semillaCentralUnica) {
      lista.forEach((id, i) => colocar(id, c, (i / Math.max(1, lista.length)) * Math.PI * 2 - Math.PI / 2))
      continue
    }

    // El resto: abanico alrededor del ángulo del padre, con apertura según el nº
    // de hermanos (pero acotada para no solaparse con ramas vecinas).
    const grupos = new Map<string, string[]>()
    for (const id of lista) {
      const p = padre.get(id) ?? '_'
      if (!grupos.has(p)) grupos.set(p, [])
      grupos.get(p)!.push(id)
    }
    for (const [p, hijos] of grupos) {
      const base = angulo.get(p) ?? -Math.PI / 2
      const apertura = Math.min(Math.PI * 0.85, 0.42 * hijos.length)
      hijos.forEach((id, idx) => {
        const a = hijos.length === 1 ? base : base + (idx - (hijos.length - 1) / 2) * (apertura / (hijos.length - 1))
        colocar(id, c, a)
      })
    }
  }

  for (const n of nodos) {
    n.x = Math.max(0.02, Math.min(0.98, n.x))
    n.y = Math.max(0.02, Math.min(0.98, n.y))
  }

  const aristas = grafo.relaciones
    .filter((r) => ids.has(r.desde) && ids.has(r.hasta))
    .map((r) => ({ desde: r.desde, hasta: r.hasta, tipo: r.tipo }))

  return { nodos, aristas }
}
