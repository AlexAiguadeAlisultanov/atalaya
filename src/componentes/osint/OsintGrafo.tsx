// Grafo de entidades OSINT. Reutiliza el lenguaje visual del mapa de superficie
// (nodos por capas con halo y glow, aristas en curva con degradado, foco+contexto
// en hover/selección, zoom con rueda y arrastre, centrar) pero colorea por TIPO
// de entidad en vez de por severidad, y marca la semilla y las brechas. Las
// posiciones las calcula el motor (construirVistaOsint); aquí solo se dibuja. El
// lienzo necesita ALTURA EXPLÍCITA en su caja, o el SVG sale diminuto.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Entidad, TipoEntidad, VistaOsint } from '../../engine/osint/tipos'
import { COLOR_TIPO, ETIQUETA_TIPO } from './paleta'

const VB = { x: -80, y: -70, w: 1160, h: 1180 }

function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x
}
function coord(x: number, y: number): { cx: number; cy: number } {
  return { cx: x * 1000, cy: y * 1000 }
}
function radioDe(tipo: TipoEntidad, semilla: boolean): number {
  if (semilla) return 32
  switch (tipo) {
    case 'persona':
      return 24
    case 'dominio':
    case 'organizacion':
    case 'email':
      return 20
    case 'brecha':
      return 19
    case 'telefono':
      return 16
    default:
      return 18
  }
}
function prefiereMenosMovimiento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function esMovil(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

// Bézier cuadrática con una comba suave: evita el aspecto de diagrama plano de
// las líneas rectas sin perder la lectura radial del pivoteo.
function curva(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const nx = -(y2 - y1)
  const ny = x2 - x1
  const k = 0.09
  return `M ${x1} ${y1} Q ${mx + nx * k} ${my + ny * k} ${x2} ${y2}`
}

interface Vista {
  k: number
  x: number
  y: number
}

// Encaja el contenido en el lienzo: la disposición del motor apunta hacia arriba
// desde la semilla, así que no se recalcula ninguna posición, solo la cámara
// inicial (y el botón de centrar) para que el grafo entre centrado y legible.
function calcularFit(nodos: ReadonlyArray<{ x: number; y: number; tipo: TipoEntidad; semilla: boolean }>): Vista {
  if (nodos.length === 0) return { k: 1, x: 0, y: 0 }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const n of nodos) {
    const cx = n.x * 1000
    const cy = n.y * 1000
    const r = radioDe(n.tipo, n.semilla) + 24
    minX = Math.min(minX, cx - r)
    maxX = Math.max(maxX, cx + r)
    minY = Math.min(minY, cy - r)
    maxY = Math.max(maxY, cy + r + 28) // hueco para la etiqueta de debajo
  }
  const bw = Math.max(1, maxX - minX)
  const bh = Math.max(1, maxY - minY)
  const m = 70
  const k = Math.max(0.55, Math.min(1.7, Math.min((VB.w - 2 * m) / bw, (VB.h - 2 * m) / bh)))
  const ccx = (minX + maxX) / 2
  const ccy = (minY + maxY) / 2
  return { k, x: VB.x + VB.w / 2 - k * ccx, y: VB.y + VB.h / 2 - k * ccy }
}

const TIPOS_LEYENDA: TipoEntidad[] = [
  'email',
  'usuario',
  'persona',
  'cuenta',
  'dominio',
  'organizacion',
  'ip',
  'brecha',
]

export function OsintGrafo({
  vista,
  entidades,
  seleccion,
  onSeleccion,
}: {
  vista: VistaOsint
  entidades: Map<string, Entidad>
  seleccion: string | null
  onSeleccion: (e: Entidad | null) => void
}) {
  const [interactivo] = useState(() => !esMovil())
  const [reduce] = useState(() => prefiereMenosMovimiento())
  const [hover, setHover] = useState<string | null>(null)
  const fit = useMemo(() => calcularFit(vista.nodos), [vista.nodos])
  const [view, setView] = useState<Vista>(fit)

  const svgRef = useRef<SVGSVGElement>(null)
  const viewRef = useRef(view)
  useEffect(() => {
    viewRef.current = view
  }, [view])
  const montado = useRef(true)
  useEffect(() => () => {
    montado.current = false
  }, [])

  // Adyacencia no dirigida y aristas ya preparadas para pintar.
  const { adj, nodos, aristas } = useMemo(() => {
    const porNodo = new Map(vista.nodos.map((n) => [n.id, n]))
    const adj = new Map<string, string[]>()
    for (const n of vista.nodos) adj.set(n.id, [])
    const aristas = vista.aristas
      .map((a, i) => {
        const d = porNodo.get(a.desde)
        const h = porNodo.get(a.hasta)
        if (!d || !h) return null
        adj.get(a.desde)!.push(a.hasta)
        adj.get(a.hasta)!.push(a.desde)
        const p1 = coord(d.x, d.y)
        const p2 = coord(h.x, h.y)
        const caliente = h.tipo === 'brecha' || d.tipo === 'brecha'
        return {
          i,
          desde: a.desde,
          hasta: a.hasta,
          tipo: a.tipo,
          d: curva(p1.cx, p1.cy, p2.cx, p2.cy),
          mx: (p1.cx + p2.cx) / 2,
          my: (p1.cy + p2.cy) / 2,
          x1: p1.cx,
          y1: p1.cy,
          x2: p2.cx,
          y2: p2.cy,
          pcolor: COLOR_TIPO[d.tipo],
          color: COLOR_TIPO[h.tipo],
          caliente,
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
    return { adj, nodos: vista.nodos, aristas }
  }, [vista])

  // Conjunto iluminado según el foco: en hover, el nodo y sus vecinos directos;
  // en selección, su vecindad a dos saltos (el pivoteo alrededor del dato).
  const foco = hover ?? seleccion
  const modo: 'hover' | 'sel' | 'none' = hover ? 'hover' : seleccion ? 'sel' : 'none'
  const iluminados = useMemo(() => {
    if (!foco) return null
    const profundidad = modo === 'hover' ? 1 : 2
    const set = new Set<string>([foco])
    let frente = [foco]
    for (let d = 0; d < profundidad; d++) {
      const siguiente: string[] = []
      for (const id of frente) {
        for (const v of adj.get(id) ?? []) {
          if (!set.has(v)) {
            set.add(v)
            siguiente.push(v)
          }
        }
      }
      frente = siguiente
    }
    return set
  }, [foco, modo, adj])

  const estaIluminado = (id: string) => !iluminados || iluminados.has(id)

  // --- Zoom y desplazamiento (imperativo sobre la vista; un solo setState) ---
  const puntoSvg = (cx: number, cy: number): { x: number; y: number } => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = cx
    pt.y = cy
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const q = pt.matrixTransform(m.inverse())
    return { x: q.x, y: q.y }
  }

  const animarA = useCallback(
    (destino: Vista) => {
      if (reduce) {
        setView(destino)
        return
      }
      const inicio = viewRef.current
      const t0 = performance.now()
      const dur = 260
      const paso = (ahora: number) => {
        if (!montado.current) return
        const t = Math.min(1, (ahora - t0) / dur)
        const e = 1 - Math.pow(1 - t, 3)
        setView({
          k: inicio.k + (destino.k - inicio.k) * e,
          x: inicio.x + (destino.x - inicio.x) * e,
          y: inicio.y + (destino.y - inicio.y) * e,
        })
        if (t < 1) requestAnimationFrame(paso)
      }
      requestAnimationFrame(paso)
    },
    [reduce],
  )

  const zoomPor = useCallback(
    (factor: number) => {
      const svg = svgRef.current
      if (!svg) return
      const r = svg.getBoundingClientRect()
      const p = puntoSvg(r.left + r.width / 2, r.top + r.height / 2)
      const v = viewRef.current
      const k2 = clamp(v.k * factor, 0.55, 4.5)
      const ratio = k2 / v.k
      animarA({ k: k2, x: p.x - ratio * (p.x - v.x), y: p.y - ratio * (p.y - v.y) })
    },
    [animarA],
  )

  // La rueda necesita un listener nativo no pasivo para poder frenar el scroll.
  useEffect(() => {
    const svg = svgRef.current
    if (!svg || !interactivo) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const p = puntoSvg(e.clientX, e.clientY)
      const v = viewRef.current
      const factor = Math.exp(-e.deltaY * 0.0015)
      const k2 = clamp(v.k * factor, 0.55, 4.5)
      const ratio = k2 / v.k
      setView({ k: k2, x: p.x - ratio * (p.x - v.x), y: p.y - ratio * (p.y - v.y) })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [interactivo])

  const arrastre = useRef<{ lx: number; ly: number; dist: number } | null>(null)
  const arrastrado = useRef(false)

  const onFondoPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!interactivo) return
    const p = puntoSvg(e.clientX, e.clientY)
    arrastre.current = { lx: p.x, ly: p.y, dist: 0 }
    arrastrado.current = false
    svgRef.current?.setPointerCapture(e.pointerId)
  }
  const onFondoPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = arrastre.current
    if (!d) return
    const p = puntoSvg(e.clientX, e.clientY)
    const dx = p.x - d.lx
    const dy = p.y - d.ly
    d.dist += Math.hypot(dx, dy)
    if (d.dist > 6) arrastrado.current = true
    d.lx = p.x
    d.ly = p.y
    setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
  }
  const onFondoPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    arrastre.current = null
    svgRef.current?.releasePointerCapture?.(e.pointerId)
  }

  const transform = `translate(${view.x} ${view.y}) scale(${view.k})`

  return (
    <div className={`og-wrap${interactivo ? '' : ' og-wrap--plano'}`}>
      <svg
        ref={svgRef}
        className="og"
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        role="group"
        aria-label="Grafo de entidades descubiertas. Cada nodo es un dato; pulsa uno para ver su ficha. Los mismos datos están en el resumen por tipo que hay al lado."
        onPointerDown={onFondoPointerDown}
        onPointerMove={onFondoPointerMove}
        onPointerUp={onFondoPointerUp}
        onPointerCancel={onFondoPointerUp}
        onClick={(e) => {
          if (e.target === e.currentTarget && !arrastrado.current) onSeleccion(null)
        }}
      >
        <defs>
          <radialGradient id="og-seedglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity="0.34" />
            <stop offset="45%" stopColor="#7c5cff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="og-vineta" cx="50%" cy="46%" r="62%">
            <stop offset="55%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#05070d" stopOpacity="0.7" />
          </radialGradient>
          {aristas.map((e) => (
            <linearGradient
              key={`g${e.i}`}
              id={`og-edge-${e.i}`}
              gradientUnits="userSpaceOnUse"
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
            >
              <stop offset="0%" stopColor={e.pcolor} stopOpacity="0.16" />
              <stop offset="100%" stopColor={e.color} stopOpacity={e.caliente ? 0.95 : 0.62} />
            </linearGradient>
          ))}
        </defs>

        {/* Profundidad: anillos concéntricos, glow de la semilla y viñeteado. */}
        <g className="og-depth" aria-hidden="true">
          <circle cx={500} cy={500} r={200} className="og-ring" />
          <circle cx={500} cy={500} r={360} className="og-ring" />
          <circle cx={500} cy={500} r={480} className="og-ring og-ring--ext" />
          <circle cx={500} cy={500} r={260} fill="url(#og-seedglow)" />
          <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="url(#og-vineta)" />
        </g>

        <g transform={transform}>
          {/* Aristas en curva con degradado; las que tocan una brecha, calientes. */}
          <g className="og-edges" aria-hidden="true">
            {aristas.map((e) => {
              const encendida = estaIluminado(e.desde) && estaIluminado(e.hasta)
              const verEtq = iluminados !== null && encendida
              return (
                <g key={e.i} className={encendida ? 'og-edgewrap' : 'og-edgewrap og-edgewrap--dim'}>
                  <path
                    d={e.d}
                    className="og-edge"
                    stroke={`url(#og-edge-${e.i})`}
                    strokeWidth={e.caliente ? 3.4 : 2.6}
                    style={e.caliente ? { filter: `drop-shadow(0 0 5px ${e.color})` } : undefined}
                  />
                  {e.caliente && !reduce ? (
                    <path d={e.d} className="og-flow" stroke={e.color} strokeWidth={2.2} />
                  ) : null}
                  {verEtq ? (
                    <text x={e.mx} y={e.my - 4} textAnchor="middle" className="og-edgelabel">
                      {e.tipo}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </g>

          {/* Nodos: halo del color del tipo + núcleo; semilla destacada, brecha con aura. */}
          <g className="og-nodes">
            {nodos.map((n) => {
              const ent = entidades.get(n.id)
              const { cx, cy } = coord(n.x, n.y)
              const sel = seleccion === n.id
              const esHover = hover === n.id
              const color = COLOR_TIPO[n.tipo]
              const R = radioDe(n.tipo, n.semilla)
              const dim = foco && !estaIluminado(n.id)
              const foconodo = sel || esHover
              const brecha = n.tipo === 'brecha'

              return (
                <g
                  key={n.id}
                  className={`og-nodo og-nodo--${n.tipo}${sel ? ' og-nodo--sel' : ''}${dim ? ' og-nodo--dim' : ''}${foconodo ? ' og-nodo--foco' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${ETIQUETA_TIPO[n.tipo]}: ${n.etiqueta}${n.semilla ? ', semilla' : ''}`}
                  aria-pressed={sel}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (ent) onSeleccion(ent)
                  }}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
                  onFocus={() => setHover(n.id)}
                  onBlur={() => setHover((h) => (h === n.id ? null : h))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      if (ent) onSeleccion(ent)
                    }
                  }}
                >
                  {/* zona de clic cómoda, invisible */}
                  <circle cx={cx} cy={cy} r={R + 14} fill="transparent" />

                  {/* aura pulsante de las brechas (lo expuesto) */}
                  {brecha ? (
                    <circle cx={cx} cy={cy} r={R + 12} className="og-brecha" fill="none" stroke={color} strokeWidth={2} />
                  ) : null}

                  {/* glow suave de la semilla */}
                  {n.semilla ? <circle cx={cx} cy={cy} r={R + 20} fill="url(#og-seedglow)" /> : null}

                  {/* anillo de selección */}
                  {sel ? (
                    <circle cx={cx} cy={cy} r={R + 9} className="og-selring" fill="none" stroke={color} strokeWidth={1.4} />
                  ) : null}

                  {/* halo del color del tipo */}
                  <circle cx={cx} cy={cy} r={R + 6} className="og-halo" fill="none" stroke={color} strokeWidth={1.4} />

                  {/* núcleo: la semilla va rellena con anillo interior; el resto, hueco */}
                  {n.semilla ? (
                    <>
                      <circle cx={cx} cy={cy} r={R} fill={color} className="og-core og-core--seed" />
                      <circle cx={cx} cy={cy} r={R - 10} fill="none" stroke="#fff" strokeWidth={1.2} opacity={0.5} />
                    </>
                  ) : brecha ? (
                    <circle cx={cx} cy={cy} r={R - 4} fill={color} className="og-core" style={{ filter: `drop-shadow(0 0 7px ${color})` }} />
                  ) : (
                    <>
                      <circle cx={cx} cy={cy} r={R - 4} fill="#0b0f17" stroke={color} strokeWidth={2.4} className="og-core" style={{ filter: `drop-shadow(0 0 6px ${color}aa)` }} />
                      <circle cx={cx} cy={cy} r={5} fill={color} />
                    </>
                  )}

                  <text
                    x={cx}
                    y={cy + R + 24}
                    textAnchor="middle"
                    className={`og-label og-label--${n.tipo}${n.semilla ? ' og-label--seed' : ''}${foconodo ? ' og-label--foco' : ''}`}
                  >
                    {n.etiqueta}
                  </text>
                </g>
              )
            })}
          </g>
        </g>
      </svg>

      {/* Leyenda de tipos de entidad */}
      <div className="og-leyenda" aria-hidden="true">
        {TIPOS_LEYENDA.map((t) => (
          <span key={t} className="og-ley">
            <i style={{ background: COLOR_TIPO[t] }} />
            {ETIQUETA_TIPO[t]}
          </span>
        ))}
      </div>

      {interactivo ? (
        <div className="og-ctrl no-imprimir">
          <button type="button" onClick={() => zoomPor(1.35)} aria-label="Acercar">
            +
          </button>
          <button type="button" onClick={() => zoomPor(1 / 1.35)} aria-label="Alejar">
            −
          </button>
          <button
            type="button"
            className="og-ctrl-fit"
            onClick={() => animarA(fit)}
            aria-label="Centrar y ajustar"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
              <circle cx="10" cy="10" r="4" />
              <path d="M10 2v3M10 15v3M2 10h3M15 10h3" />
            </svg>
          </button>
        </div>
      ) : null}
    </div>
  )
}
