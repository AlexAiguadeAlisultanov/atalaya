// Motor de dibujo de la escena cinematográfica de la portada. No sabe nada de
// React ni del scroll: recibe un progreso 0..1 ya suavizado y un tiempo en
// segundos, y pinta un fotograma completo sobre un canvas 2D.
//
// Es un vuelo por un corredor digital: rejilla en perspectiva que fluye hacia
// la cámara, campo de partículas con parallax por profundidad, estelas de datos,
// puertos que se encienden, una constelación de amenaza que late en rojo y un
// colapso final hacia el centro. Toda la riqueza se consigue combinando capas
// con mezcla aditiva (globalCompositeOperation = 'lighter') y degradados de
// profundidad; el viñeteado, el grano y las scanlines los pone el DOM encima.

export interface ConfigEscena {
  acento: string
  acento2: string
  critico: string
  alto: string
  /** Cuántos focos de amenaza encender en el beat rojo. Sale de datos reales. */
  nAmenazas: number
  movil: boolean
}

export interface Motor {
  redimensionar(anchoCss: number, altoCss: number, dpr: number): void
  dibujar(progreso: number, tiempo: number): void
}

type RGB = [number, number, number]

interface Particula {
  x: number
  y: number
  z: number
  capa: number
  brillo: number
  calida: boolean
}
interface Estela {
  carril: number
  y: number
  z: number
  vel: number
  largo: number
  frio: boolean
}
interface Puerto {
  x: number
  z: number
  retardo: number
}
interface Amenaza {
  x: number
  y: number
  z: number
  fase: number
  critica: boolean
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
const suave = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a))
  return t * t * (3 - 2 * t)
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
// Módulo siempre positivo, para reciclar la profundidad en un bucle infinito.
const mod = (x: number, m: number) => ((x % m) + m) % m

function hexARgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

// Generador pseudoaleatorio con semilla: el reparto de partículas y amenazas es
// el mismo en cada carga, así la escena no "baila" entre recargas.
function mulberry32(semilla: number) {
  let a = semilla
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function crearMotor(ctx: CanvasRenderingContext2D, cfg: ConfigEscena): Motor {
  const VIOLETA = hexARgb(cfg.acento)
  const VIOLETA2 = hexARgb(cfg.acento2)
  const CRIT = hexARgb(cfg.critico)
  const ALTO = hexARgb(cfg.alto)
  const BLANCO: RGB = [233, 238, 248]

  const rnd = mulberry32(0x7c5cff)

  // Densidad adaptada al dispositivo: móvil más ligero, pero aún poblado.
  const N_PART = cfg.movil ? 190 : 480
  const N_ESTELAS = cfg.movil ? 40 : 96
  const N_PUERTOS = cfg.movil ? 16 : 30
  const N_RUNGS = cfg.movil ? 30 : 48
  const N_CARRILES = cfg.movil ? 13 : 19

  // Geometría del corredor, en coordenadas de mundo.
  const Z_CERCA = 0.45
  const Z_LEJOS = 15
  const GY = 2.15 // separación de suelo y techo respecto al eje de vuelo
  const XSPAN = 5.4 // medio ancho del corredor
  const PASO_CARRIL = (XSPAN * 2) / (N_CARRILES - 1)

  // Campo de partículas: profundidad y capa de parallax repartidas.
  const particulas: Particula[] = []
  for (let i = 0; i < N_PART; i++) {
    particulas.push({
      x: (rnd() * 2 - 1) * XSPAN * 1.7,
      y: (rnd() * 2 - 1) * GY * 1.7,
      z: Z_CERCA + rnd() * (Z_LEJOS - Z_CERCA),
      capa: 0.5 + rnd() * 1.1,
      brillo: 0.3 + rnd() * 0.7,
      calida: rnd() > 0.82,
    })
  }

  const estelas: Estela[] = []
  for (let i = 0; i < N_ESTELAS; i++) {
    estelas.push({
      carril: Math.floor(rnd() * N_CARRILES),
      y: (rnd() > 0.5 ? 1 : -1) * GY * (0.3 + rnd() * 0.7),
      z: Z_CERCA + rnd() * (Z_LEJOS - Z_CERCA),
      vel: 0.6 + rnd() * 1.4,
      largo: 0.5 + rnd() * 1.6,
      frio: rnd() > 0.5,
    })
  }

  const puertos: Puerto[] = []
  for (let i = 0; i < N_PUERTOS; i++) {
    puertos.push({
      x: (Math.floor(rnd() * N_CARRILES) - (N_CARRILES - 1) / 2) * PASO_CARRIL,
      z: Z_CERCA + rnd() * (Z_LEJOS - Z_CERCA),
      retardo: rnd(),
    })
  }

  // Constelación de amenaza: flota en el eje del corredor, por delante.
  const nAm = Math.max(7, Math.min(cfg.movil ? 12 : 20, cfg.nAmenazas))
  const amenazas: Amenaza[] = []
  for (let i = 0; i < nAm; i++) {
    const ang = rnd() * Math.PI * 2
    const rad = 0.4 + rnd() * 1.5
    amenazas.push({
      x: Math.cos(ang) * rad,
      y: Math.sin(ang) * rad * 0.8,
      z: 1.2 + rnd() * 6,
      fase: rnd(),
      critica: i % 3 === 0,
    })
  }

  let W = 0
  let H = 0
  let cx = 0
  let hy = 0
  let f = 0

  function redimensionar(anchoCss: number, altoCss: number, dpr: number) {
    W = anchoCss
    H = altoCss
    cx = W / 2
    hy = H * 0.5
    f = H * 1.08
    // Todo el dibujo se hace en píxeles CSS; el DPR escala el lienzo real.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  // Fondo de profundidad: casi negro con un tinte violeta hacia el eje.
  function fondo(aparicion: number) {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#05070c')
    g.addColorStop(0.5, '#080a14')
    g.addColorStop(1, '#04050a')
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)

    const r = ctx.createRadialGradient(cx, hy, 0, cx, hy, Math.max(W, H) * 0.7)
    r.addColorStop(0, rgba(VIOLETA, 0.1 * aparicion))
    r.addColorStop(0.5, rgba(VIOLETA, 0.03 * aparicion))
    r.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = r
    ctx.fillRect(0, 0, W, H)
  }

  function campoParticulas(avance: number, aparicion: number, tiempo: number) {
    ctx.globalCompositeOperation = 'lighter'
    for (const p of particulas) {
      const ze = Z_CERCA + mod(p.z - avance * p.capa, Z_LEJOS - Z_CERCA)
      const s = f / ze
      const sx = cx + p.x * s
      const sy = hy + p.y * s
      if (sx < -40 || sx > W + 40 || sy < -40 || sy > H + 40) continue
      const prof = 1 - (ze - Z_CERCA) / (Z_LEJOS - Z_CERCA)
      const r = Math.max(0.4, prof * prof * 2.6)
      const parpadeo = 0.75 + 0.25 * Math.sin(tiempo * 2 + p.z * 9)
      const a = p.brillo * prof * parpadeo * aparicion
      if (a < 0.015) continue
      const col = p.calida ? VIOLETA2 : BLANCO
      if (prof > 0.55) {
        const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4)
        halo.addColorStop(0, rgba(col, a * 0.5))
        halo.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = halo
        ctx.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8)
      }
      ctx.fillStyle = rgba(col, Math.min(1, a))
      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  function rejilla(avance: number, intensidad: number, tiempo: number) {
    if (intensidad < 0.01) return
    ctx.globalCompositeOperation = 'lighter'
    const paso = (Z_LEJOS - Z_CERCA) / N_RUNGS

    // Rayos longitudinales: convergen al punto de fuga.
    for (let k = 0; k < N_CARRILES; k++) {
      const x = (k - (N_CARRILES - 1) / 2) * PASO_CARRIL
      const cerca = 0.9
      const sNear = f / cerca
      const sFar = f / Z_LEJOS
      const a = intensidad * 0.22 * (1 - Math.abs(x) / (XSPAN * 1.25))
      if (a <= 0.004) continue
      ctx.strokeStyle = rgba(VIOLETA, Math.max(0, a))
      ctx.lineWidth = 1
      // suelo
      ctx.beginPath()
      ctx.moveTo(cx + x * sNear, hy + GY * sNear)
      ctx.lineTo(cx + x * sFar, hy + GY * sFar)
      ctx.stroke()
      // techo
      ctx.beginPath()
      ctx.moveTo(cx + x * sNear, hy - GY * sNear)
      ctx.lineTo(cx + x * sFar, hy - GY * sFar)
      ctx.stroke()
    }

    // Travesaños que fluyen hacia la cámara.
    for (let i = 0; i < N_RUNGS; i++) {
      const base = Z_CERCA + i * paso
      const ze = Z_CERCA + mod(base - avance, Z_LEJOS - Z_CERCA)
      const s = f / ze
      const prof = 1 - (ze - Z_CERCA) / (Z_LEJOS - Z_CERCA)
      const borde = suave(Z_CERCA, Z_CERCA + 1.1, ze)
      const a = intensidad * prof * borde * 0.6
      if (a < 0.01) continue
      const lx = cx - XSPAN * s
      const rx = cx + XSPAN * s
      const yf = hy + GY * s
      const yc = hy - GY * s
      const pulso = 0.85 + 0.15 * Math.sin(tiempo * 3 - i)
      ctx.strokeStyle = rgba(VIOLETA2, a * pulso)
      ctx.lineWidth = Math.max(1, prof * 2.2)
      ctx.beginPath()
      ctx.moveTo(lx, yf)
      ctx.lineTo(rx, yf)
      ctx.stroke()
      ctx.strokeStyle = rgba(VIOLETA, a * pulso * 0.7)
      ctx.beginPath()
      ctx.moveTo(lx, yc)
      ctx.lineTo(rx, yc)
      ctx.stroke()
    }
  }

  function flujoDatos(avance: number, intensidad: number) {
    ctx.globalCompositeOperation = 'lighter'
    for (const e of estelas) {
      const ze = Z_CERCA + mod(e.z - avance * e.vel, Z_LEJOS - Z_CERCA)
      const prof = 1 - (ze - Z_CERCA) / (Z_LEJOS - Z_CERCA)
      const borde = suave(Z_CERCA, Z_CERCA + 0.8, ze)
      const a = intensidad * prof * borde
      if (a < 0.02) continue
      const x = (e.carril - (N_CARRILES - 1) / 2) * PASO_CARRIL
      const s1 = f / ze
      const z2 = ze + e.largo
      const s2 = f / z2
      const col = e.frio ? VIOLETA2 : VIOLETA
      ctx.strokeStyle = rgba(col, a)
      ctx.lineWidth = Math.max(1, prof * 3)
      ctx.beginPath()
      ctx.moveTo(cx + x * s1, hy + e.y * s1)
      ctx.lineTo(cx + x * s2, hy + e.y * s2)
      ctx.stroke()
      // cabeza brillante
      const r = Math.max(0.6, prof * 3)
      const halo = ctx.createRadialGradient(cx + x * s1, hy + e.y * s1, 0, cx + x * s1, hy + e.y * s1, r * 3)
      halo.addColorStop(0, rgba(col, a))
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = halo
      ctx.fillRect(cx + x * s1 - r * 3, hy + e.y * s1 - r * 3, r * 6, r * 6)
    }
  }

  function puertosEncendidos(avance: number, cantidad: number, tiempo: number) {
    if (cantidad < 0.01) return
    ctx.globalCompositeOperation = 'lighter'
    const encendidos = cantidad * N_PUERTOS
    puertos.forEach((p, i) => {
      const o = clamp01(encendidos - i)
      if (o < 0.02) return
      const ze = Z_CERCA + mod(p.z - avance, Z_LEJOS - Z_CERCA)
      const prof = 1 - (ze - Z_CERCA) / (Z_LEJOS - Z_CERCA)
      const borde = suave(Z_CERCA, Z_CERCA + 0.9, ze)
      const s = f / ze
      const sx = cx + p.x * s
      const sy = hy + GY * s
      const latido = 0.6 + 0.4 * Math.sin(tiempo * 4 + p.retardo * 7)
      const a = o * prof * borde * latido
      if (a < 0.02) return
      const r = Math.max(1, prof * 5)
      // haz vertical desde el suelo
      const haz = ctx.createLinearGradient(sx, sy, sx, sy - r * 9)
      haz.addColorStop(0, rgba(VIOLETA2, a * 0.8))
      haz.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = haz
      ctx.fillRect(sx - r * 0.5, sy - r * 9, r, r * 9)
      const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4)
      halo.addColorStop(0, rgba(BLANCO, a))
      halo.addColorStop(0.4, rgba(VIOLETA2, a * 0.8))
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = halo
      ctx.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8)
    })
  }

  function constelacionAmenaza(avance: number, intensidad: number, tiempo: number) {
    if (intensidad < 0.01) return
    ctx.globalCompositeOperation = 'lighter'
    const pts = amenazas.map((m) => {
      const ze = Z_CERCA + mod(m.z - avance, Z_LEJOS - Z_CERCA)
      const prof = 1 - (ze - Z_CERCA) / (Z_LEJOS - Z_CERCA)
      const borde = suave(Z_CERCA, Z_CERCA + 1, ze)
      const s = f / ze
      return { sx: cx + m.x * s, sy: hy + m.y * s, prof, borde, m }
    })

    // Hilos entre focos cercanos: dan la lectura de constelación sin ser un grafo.
    ctx.lineWidth = 1
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].sx - pts[j].sx, pts[i].sy - pts[j].sy)
        if (d > W * 0.16) continue
        const a = intensidad * 0.14 * (1 - d / (W * 0.16)) * pts[i].borde * pts[j].borde
        if (a < 0.015) continue
        ctx.strokeStyle = rgba(CRIT, a)
        ctx.beginPath()
        ctx.moveTo(pts[i].sx, pts[i].sy)
        ctx.lineTo(pts[j].sx, pts[j].sy)
        ctx.stroke()
      }
    }

    for (const p of pts) {
      const latido = 0.5 + 0.5 * Math.sin(tiempo * 3.4 + p.m.fase * 7)
      const a = intensidad * p.prof * p.borde * (0.45 + 0.55 * latido)
      if (a < 0.02) continue
      const col = p.m.critica ? CRIT : ALTO
      const r = Math.max(1.4, p.prof * (p.m.critica ? 7 : 5))
      const halo = ctx.createRadialGradient(p.sx, p.sy, 0, p.sx, p.sy, r * 5)
      halo.addColorStop(0, rgba(col, Math.min(1, a)))
      halo.addColorStop(0.3, rgba(col, a * 0.6))
      halo.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = halo
      ctx.fillRect(p.sx - r * 5, p.sy - r * 5, r * 10, r * 10)
      ctx.fillStyle = rgba(BLANCO, Math.min(1, a))
      ctx.beginPath()
      ctx.arc(p.sx, p.sy, r * 0.4, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  // Barrido de escaneo: una banda horizontal de luz que recorre la escena.
  function barrido(intensidad: number, tiempo: number) {
    if (intensidad < 0.01) return
    ctx.globalCompositeOperation = 'lighter'
    const y = mod(tiempo * 90, H + 200) - 100
    const alto = 160
    const g = ctx.createLinearGradient(0, y - alto, 0, y + alto)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.5, rgba(VIOLETA2, 0.05 * intensidad))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, y - alto, W, alto * 2)
  }

  // Colapso final: un núcleo de luz crece en el eje y lo inunda todo.
  function colapso(converge: number) {
    if (converge < 0.01) return
    ctx.globalCompositeOperation = 'lighter'
    const r = lerp(0, Math.max(W, H) * 0.42, converge)
    const g = ctx.createRadialGradient(cx, hy, 0, cx, hy, r)
    g.addColorStop(0, rgba(BLANCO, 0.5 * converge))
    g.addColorStop(0.2, rgba(VIOLETA2, 0.35 * converge))
    g.addColorStop(0.6, rgba(VIOLETA, 0.12 * converge))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
  }

  function dibujar(progreso: number, tiempo: number) {
    const p = clamp01(progreso)

    // Parámetros por beat, todos derivados del mismo progreso. La aparición
    // arranca con un suelo: el héroe ya tiene un fondo vivo, tenue, que sube a
    // pleno rendimiento en cuanto se entra en la secuencia.
    const aparicion = 0.28 + 0.72 * suave(0.0, 0.08, p)
    const extenso = suave(0.1, 0.32, p) // la rejilla se puebla y extiende
    const puertos01 = suave(0.42, 0.64, p)
    const converge = suave(0.82, 0.99, p)
    const amenaza01 = suave(0.58, 0.8, p) * (1 - converge * 0.45)
    const velocidad = 0.9 + suave(0.1, 0.55, p) * 1.3 + converge * 3.4

    // Avance de cámara: dominado por el scroll, con una deriva continua para que
    // la escena respire aunque nadie toque la rueda.
    const avance = p * 10 * velocidad + tiempo * 0.5 * velocidad

    // Micro-temblor cinematográfico, mayor en el colapso.
    const temblor = (0.6 + converge * 5) * aparicion
    const sx = Math.sin(tiempo * 2.1) * temblor
    const sy = Math.cos(tiempo * 1.7) * temblor * 0.6
    cx = W / 2 + sx
    hy = H * 0.5 + sy

    fondo(aparicion)
    campoParticulas(avance, aparicion, tiempo)
    rejilla(avance, extenso * aparicion, tiempo)
    flujoDatos(avance, (0.35 + extenso * 0.65) * aparicion)
    puertosEncendidos(avance, puertos01, tiempo)
    constelacionAmenaza(avance, amenaza01, tiempo)
    barrido(aparicion * (0.4 + extenso * 0.6), tiempo)
    colapso(converge)

    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
  }

  return { redimensionar, dibujar }
}
