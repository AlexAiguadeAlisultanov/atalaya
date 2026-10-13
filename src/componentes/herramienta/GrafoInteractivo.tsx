// Mapa interactivo de la superficie de ataque. Las posiciones las calcula el
// motor (construirGrafo); aquí se dibuja un HUD por capas (profundidad, aristas
// en curva con degradado, nodos con halo y glow) y se resuelve la interacción:
// hover que ilumina el nodo y sus aristas, selección que resalta toda su rama,
// zoom con rueda y arrastre para desplazar. El lienzo necesita ALTURA EXPLÍCITA
// en su caja, o el SVG sale diminuto.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { GrafoVista, NodoGrafo, Severidad } from '../../engine'
import { COLOR_SEVERIDAD, ETIQUETA_SEVERIDAD } from '../../lib/severidad'

const VIOLET = '#7C5CFF'
const VB = { x: -80, y: -70, w: 1160, h: 1180 }

const ORDEN: Record<Severidad, number> = { critica: 4, alta: 3, media: 2, baja: 1, info: 0 }

function clamp(x: number, min: number, max: number): number {
  return x < min ? min : x > max ? max : x
}
function coord(n: NodoGrafo): { cx: number; cy: number } {
  return { cx: n.x * 1000, cy: n.y * 1000 }
}
function colorNodo(n: NodoGrafo): string {
  return n.tipo === 'dominio' || n.tipo === 'subdominio' ? VIOLET : COLOR_SEVERIDAD[n.severidad]
}
function radioNodo(n: NodoGrafo): number {
  return n.tipo === 'dominio' ? 40 : n.tipo === 'activo' ? 24 : n.tipo === 'subdominio' ? 16 : 17
}
function etiquetaNodo(n: NodoGrafo): string {
  const tipo =
    n.tipo === 'dominio' ? 'dominio' :
    n.tipo === 'subdominio' ? 'subdominio' :
    n.tipo === 'activo' ? 'activo' : 'vulnerabilidad'
  return `${tipo} ${n.etiqueta}${n.kev ? ', en explotación activa' : ''}`
}
function prefiereMenosMovimiento(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function esMovil(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches
}

// Bézier cuadrática con una comba suave: evita el aspecto de diagrama plano de
// las líneas rectas sin perder la lectura radial del mapa.
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

export function GrafoInteractivo({
  grafo,
  seleccion,
  onSeleccion,
}: {
  grafo: GrafoVista
  seleccion: string | null
  onSeleccion: (n: NodoGrafo | null) => void
}) {
  const [interactivo] = useState(() => !esMovil())
  const [reduce] = useState(() => prefiereMenosMovimiento())
  const [hover, setHover] = useState<string | null>(null)
  const [view, setView] = useState<Vista>({ k: 1, x: 0, y: 0 })

  const svgRef = useRef<SVGSVGElement>(null)
  const viewRef = useRef(view)
  useEffect(() => { viewRef.current = view }, [view])
  const montado = useRef(true)
  useEffect(() => () => { montado.current = false }, [])

  // Estructura: relación padre/hijo y aristas ya preparadas para pintar.
  const { hijos, padres, nodos, aristas } = useMemo(() => {
    const porId = new Map(grafo.nodos.map((n) => [n.id, n]))
    const hijos = new Map<string, string[]>()
    const padres = new Map<string, string[]>()
    for (const a of grafo.aristas) {
      if (!porId.has(a.desde) || !porId.has(a.hasta)) continue
      ;(hijos.get(a.desde) ?? hijos.set(a.desde, []).get(a.desde)!).push(a.hasta)
      ;(padres.get(a.hasta) ?? padres.set(a.hasta, []).get(a.hasta)!).push(a.desde)
    }
    const aristas = grafo.aristas
      .map((a, i) => {
        const d = porId.get(a.desde)
        const h = porId.get(a.hasta)
        if (!d || !h) return null
        const p1 = coord(d)
        const p2 = coord(h)
        const orden = ORDEN[h.severidad]
        return {
          i,
          desde: a.desde,
          hasta: a.hasta,
          d: curva(p1.cx, p1.cy, p2.cx, p2.cy),
          x1: p1.cx, y1: p1.cy, x2: p2.cx, y2: p2.cy,
          pcolor: colorNodo(d),
          color: colorNodo(h),
          ancho: 2.4 + orden * 1.15,
          caliente: orden >= 3 || h.kev,
        }
      })
      .filter((e): e is NonNullable<typeof e> => e !== null)
    return { hijos, padres, nodos: grafo.nodos, aristas }
  }, [grafo])

  // Conjunto iluminado según el foco: en hover, el nodo y sus vecinos directos;
  // en selección, toda la rama (ascendientes hasta el dominio y descendientes).
  const foco = hover ?? seleccion
  const modo: 'hover' | 'sel' | 'none' = hover ? 'hover' : seleccion ? 'sel' : 'none'
  const iluminados = useMemo(() => {
    if (!foco) return null
    const set = new Set<string>([foco])
    if (modo === 'hover') {
      for (const h of hijos.get(foco) ?? []) set.add(h)
      for (const p of padres.get(foco) ?? []) set.add(p)
    } else {
      const pila = [foco]
      while (pila.length) {
        const id = pila.pop()!
        for (const h of hijos.get(id) ?? []) if (!set.has(h)) { set.add(h); pila.push(h) }
      }
      let actual: string | undefined = foco
      while (actual) {
        const p: string | undefined = padres.get(actual)?.[0]
        if (p && !set.has(p)) set.add(p)
        actual = p
      }
    }
    return set
  }, [foco, modo, hijos, padres])

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

  const animarA = useCallback((destino: Vista) => {
    if (reduce) { setView(destino); return }
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
  }, [reduce])

  const zoomPor = useCallback((factor: number) => {
    const svg = svgRef.current
    if (!svg) return
    const r = svg.getBoundingClientRect()
    const p = puntoSvg(r.left + r.width / 2, r.top + r.height / 2)
    const v = viewRef.current
    const k2 = clamp(v.k * factor, 0.55, 4.5)
    const ratio = k2 / v.k
    animarA({ k: k2, x: p.x - ratio * (p.x - v.x), y: p.y - ratio * (p.y - v.y) })
  }, [animarA])

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
    <div className={`gi-wrap${interactivo ? '' : ' gi-wrap--plano'}`}>
      <svg
        ref={svgRef}
        className="gi"
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        role="group"
        aria-label="Mapa de la superficie de ataque. Cada nodo es un elemento expuesto; pulsa uno para ver su ficha. Los mismos datos están en la lista de prioridades."
        onPointerDown={onFondoPointerDown}
        onPointerMove={onFondoPointerMove}
        onPointerUp={onFondoPointerUp}
        onPointerCancel={onFondoPointerUp}
        onClick={(e) => {
          if (e.target === e.currentTarget && !arrastrado.current) onSeleccion(null)
        }}
      >
        <defs>
          <radialGradient id="gi-domglow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={VIOLET} stopOpacity="0.38" />
            <stop offset="45%" stopColor={VIOLET} stopOpacity="0.12" />
            <stop offset="100%" stopColor={VIOLET} stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gi-vineta" cx="50%" cy="46%" r="62%">
            <stop offset="55%" stopColor="#000000" stopOpacity="0" />
            <stop offset="100%" stopColor="#05070d" stopOpacity="0.7" />
          </radialGradient>
          {aristas.map((e) => (
            <linearGradient
              key={`g${e.i}`}
              id={`gi-edge-${e.i}`}
              gradientUnits="userSpaceOnUse"
              x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            >
              <stop offset="0%" stopColor={e.pcolor} stopOpacity="0.15" />
              <stop offset="100%" stopColor={e.color} stopOpacity={e.caliente ? 0.95 : 0.6} />
            </linearGradient>
          ))}
        </defs>

        {/* Profundidad: glow del dominio, anillos concéntricos y viñeteado. */}
        <g className="gi-depth" aria-hidden="true">
          <circle cx={500} cy={500} r={170} className="gi-ring" />
          <circle cx={500} cy={500} r={330} className="gi-ring" />
          <circle cx={500} cy={500} r={460} className="gi-ring gi-ring--ext" />
          <circle cx={500} cy={500} r={260} fill="url(#gi-domglow)" />
          <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="url(#gi-vineta)" />
        </g>

        <g transform={transform}>
          {/* Aristas en curva con degradado; las calientes llevan flujo animado. */}
          <g className="gi-edges" aria-hidden="true">
            {aristas.map((e) => {
              const encendida = estaIluminado(e.desde) && estaIluminado(e.hasta)
              return (
                <g key={e.i} className={encendida ? 'gi-edgewrap' : 'gi-edgewrap gi-edgewrap--dim'}>
                  <path
                    d={e.d}
                    className="gi-edge"
                    stroke={`url(#gi-edge-${e.i})`}
                    strokeWidth={e.ancho}
                    style={e.caliente ? { filter: `drop-shadow(0 0 5px ${e.color})` } : undefined}
                  />
                  {e.caliente && !reduce ? (
                    <path d={e.d} className="gi-flow" stroke={e.color} strokeWidth={e.ancho * 0.7} />
                  ) : null}
                </g>
              )
            })}
          </g>

          {/* Nodos por capas: núcleo + halo de severidad + aura KEV. */}
          <g className="gi-nodes">
            {nodos.map((n) => {
              const { cx, cy } = coord(n)
              const sel = seleccion === n.id
              const esHover = hover === n.id
              const color = colorNodo(n)
              const R = radioNodo(n)
              const dim = foco && !estaIluminado(n.id)
              const foconodo = sel || esHover
              const mostrarEtq =
                n.tipo !== 'cve' || (iluminados?.has(n.id) ?? false) || foconodo

              const dyEtq = n.tipo === 'cve' ? -(R + 15) : R + 24
              const anclaEtq = n.tipo === 'dominio' ? R + 34 : dyEtq

              return (
                <g
                  key={n.id}
                  className={`gi-nodo gi-nodo--${n.tipo}${sel ? ' gi-nodo--sel' : ''}${dim ? ' gi-nodo--dim' : ''}${foconodo ? ' gi-nodo--foco' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-label={etiquetaNodo(n)}
                  aria-pressed={sel}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.stopPropagation(); onSeleccion(n) }}
                  onMouseEnter={() => setHover(n.id)}
                  onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
                  onFocus={() => setHover(n.id)}
                  onBlur={() => setHover((h) => (h === n.id ? null : h))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSeleccion(n) }
                  }}
                >
                  {/* zona de clic cómoda, invisible */}
                  <circle cx={cx} cy={cy} r={R + 14} fill="transparent" />

                  {/* aura KEV pulsante */}
                  {n.kev ? (
                    <circle cx={cx} cy={cy} r={R + 13} className="gi-kev" fill="none" stroke={COLOR_SEVERIDAD.critica} strokeWidth={2} />
                  ) : null}

                  {/* anillo de selección */}
                  {sel ? (
                    <circle cx={cx} cy={cy} r={R + 9} className="gi-selring" fill="none" stroke={color} strokeWidth={1.4} />
                  ) : null}

                  {/* halo de severidad con glow */}
                  <circle cx={cx} cy={cy} r={R + 6} className="gi-halo" fill="none" stroke={color} strokeWidth={1.4} />

                  {/* núcleo según tipo */}
                  {n.tipo === 'dominio' ? (
                    <>
                      <circle cx={cx} cy={cy} r={R} fill={color} className="gi-core gi-core--dom" />
                      <circle cx={cx} cy={cy} r={R - 10} fill="none" stroke="#fff" strokeWidth={1.2} opacity={0.5} />
                    </>
                  ) : n.tipo === 'cve' ? (
                    <circle cx={cx} cy={cy} r={R - 5} fill={color} className="gi-core" style={{ filter: `drop-shadow(0 0 7px ${color})` }} />
                  ) : (
                    <>
                      <circle cx={cx} cy={cy} r={R - 4} fill="#0b0f17" stroke={color} strokeWidth={2.4} className="gi-core" style={{ filter: `drop-shadow(0 0 6px ${color}aa)` }} />
                      <circle cx={cx} cy={cy} r={n.tipo === 'activo' ? 5 : 3.5} fill={color} />
                    </>
                  )}

                  {/* punto de brillo en los KEV */}
                  {n.kev ? <circle cx={cx - R * 0.3} cy={cy - R * 0.3} r={2.6} fill="#fff" className="gi-brillo" /> : null}

                  {mostrarEtq ? (
                    <text
                      x={cx}
                      y={cy + anclaEtq}
                      textAnchor="middle"
                      className={`gi-label gi-label--${n.tipo}${foconodo ? ' gi-label--foco' : ''}`}
                      fill={n.tipo === 'cve' ? color : undefined}
                    >
                      {n.etiqueta}
                    </text>
                  ) : null}
                </g>
              )
            })}
          </g>
        </g>
      </svg>

      {/* Leyenda de severidad + indicador KEV */}
      <div className="gi-leyenda" aria-hidden="true">
        {(['critica', 'alta', 'media', 'baja', 'info'] as Severidad[]).map((s) => (
          <span key={s} className="gi-ley">
            <i style={{ background: COLOR_SEVERIDAD[s] }} />
            {ETIQUETA_SEVERIDAD[s]}
          </span>
        ))}
        <span className="gi-ley gi-ley--kev">
          <i className="gi-ley-kev" />
          En explotación (KEV)
        </span>
      </div>

      {interactivo ? (
        <div className="gi-ctrl no-imprimir">
          <button type="button" onClick={() => zoomPor(1.35)} aria-label="Acercar">+</button>
          <button type="button" onClick={() => zoomPor(1 / 1.35)} aria-label="Alejar">−</button>
          <button type="button" className="gi-ctrl-fit" onClick={() => animarA({ k: 1, x: 0, y: 0 })} aria-label="Centrar y ajustar">
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
