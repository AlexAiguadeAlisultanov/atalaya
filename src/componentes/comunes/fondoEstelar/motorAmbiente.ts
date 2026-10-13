// Versión calmada del fondo de la portada: solo el campo de estrellas con
// parallax por profundidad y una capa de profundidad/viñeta muy tenue. Deriva
// lenta, sin rejilla en perspectiva, sin barridos ni constelación de amenaza y
// sin scrub de scroll. Pensado para vivir detrás de la herramienta sin estorbar
// la lectura de los datos: baja opacidad, el contenido manda.
//
// Comparte el mismo lenguaje visual que escena/motorEscena.ts (mismas partículas
// aditivas y profundidad), pero es un módulo aparte para no tocar la portada ya
// aprobada.

export interface ConfigAmbiente {
  acento: string
  acento2: string
  movil: boolean
}

export interface MotorAmbiente {
  redimensionar(anchoCss: number, altoCss: number, dpr: number): void
  dibujar(tiempo: number): void
}

type RGB = [number, number, number]

interface Estrella {
  x: number
  y: number
  z: number
  capa: number
  brillo: number
  calida: boolean
}

const mod = (x: number, m: number) => ((x % m) + m) % m

function hexARgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a})`

// Mismo PRNG con semilla que la portada: reparto estable entre recargas.
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

export function crearMotorAmbiente(ctx: CanvasRenderingContext2D, cfg: ConfigAmbiente): MotorAmbiente {
  const VIOLETA = hexARgb(cfg.acento)
  const VIOLETA2 = hexARgb(cfg.acento2)
  const BLANCO: RGB = [233, 238, 248]

  const rnd = mulberry32(0x5fc6d4)
  const N = cfg.movil ? 480 : 1100

  const Z_CERCA = 0.5
  const Z_LEJOS = 18
  const XSPAN = 7
  const GY = 4.5

  const estrellas: Estrella[] = []
  for (let i = 0; i < N; i++) {
    estrellas.push({
      x: (rnd() * 2 - 1) * XSPAN,
      y: (rnd() * 2 - 1) * GY,
      z: Z_CERCA + rnd() * (Z_LEJOS - Z_CERCA),
      capa: 0.4 + rnd() * 1,
      brillo: 0.3 + rnd() * 0.7,
      calida: rnd() > 0.85,
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
    hy = H * 0.42
    f = H * 0.95
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }

  function dibujar(tiempo: number) {
    // Base: degradado de profundidad casi negro. Opaco, así sustituye al fondo
    // plano de la herramienta y se ve igual hasta abajo del todo.
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = 1
    const base = ctx.createLinearGradient(0, 0, 0, H)
    base.addColorStop(0, '#05070c')
    base.addColorStop(0.5, '#080a14')
    base.addColorStop(1, '#05060c')
    ctx.fillStyle = base
    ctx.fillRect(0, 0, W, H)

    // Halo de profundidad muy tenue hacia el eje.
    const glow = ctx.createRadialGradient(cx, hy, 0, cx, hy, Math.max(W, H) * 0.75)
    glow.addColorStop(0, rgba(VIOLETA, 0.06))
    glow.addColorStop(0.55, rgba(VIOLETA, 0.02))
    glow.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)

    // Estrellas con deriva lenta hacia la cámara (parallax por capa).
    const avance = tiempo * 0.12
    ctx.globalCompositeOperation = 'lighter'
    for (const s of estrellas) {
      const ze = Z_CERCA + mod(s.z - avance * s.capa, Z_LEJOS - Z_CERCA)
      const esc = f / ze
      const sx = cx + s.x * esc
      const sy = hy + s.y * esc
      if (sx < -30 || sx > W + 30 || sy < -30 || sy > H + 30) continue
      const prof = 1 - (ze - Z_CERCA) / (Z_LEJOS - Z_CERCA)
      const r = Math.max(0.4, prof * prof * 2.1)
      const parpadeo = 0.8 + 0.2 * Math.sin(tiempo * 1.3 + s.z * 7)
      // Opacidad: más presencia para que el campo de estrellas se vea poblado.
      const a = s.brillo * prof * parpadeo * 0.85
      if (a < 0.015) continue
      const col = s.calida ? VIOLETA2 : BLANCO
      if (prof > 0.6) {
        const halo = ctx.createRadialGradient(sx, sy, 0, sx, sy, r * 4)
        halo.addColorStop(0, rgba(col, a * 0.45))
        halo.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = halo
        ctx.fillRect(sx - r * 4, sy - r * 4, r * 8, r * 8)
      }
      ctx.fillStyle = rgba(col, Math.min(1, a))
      ctx.beginPath()
      ctx.arc(sx, sy, r, 0, Math.PI * 2)
      ctx.fill()
    }

    // Viñeta tenue para asentar los bordes sin oscurecer el contenido central.
    ctx.globalCompositeOperation = 'source-over'
    const vig = ctx.createRadialGradient(cx, H * 0.5, Math.min(W, H) * 0.35, cx, H * 0.5, Math.max(W, H) * 0.75)
    vig.addColorStop(0, 'rgba(0,0,0,0)')
    vig.addColorStop(1, 'rgba(2,3,7,0.4)')
    ctx.fillStyle = vig
    ctx.fillRect(0, 0, W, H)
    ctx.globalAlpha = 1
  }

  return { redimensionar, dibujar }
}
