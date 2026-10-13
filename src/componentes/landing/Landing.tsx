// Portada cinematográfica con scroll-telling. El fondo es una escena de vuelo
// por un corredor digital (ver escena/) que se scrubbea con el scroll en seis
// beats. Encima va un HUD de cinta de vídeo: timecode, capítulo, contador y la
// nota de exposición final.
//
// El número con el que cierra la secuencia es REAL: se calcula en el navegador
// con el mismo motor que la herramienta, sobre el dominio de demostración
// banco-ejemplo.es. Así lo que ve el usuario al final del scroll es lo mismo que
// encuentra luego dentro de la herramienta.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { analizar, construirGrafo } from '../../engine'
import { superficieSembrada } from '../../datos/sembrado'
import { COLOR_NIVEL, ETIQUETA_NIVEL } from '../../lib/severidad'
import { timecode } from '../../lib/formato'
import { Cabecera } from '../Cabecera'
import { PillSeveridad, BadgeKev } from '../comunes/insignias'
import { useTecleo } from './useTecleo'
import { EscenaCine } from './escena/EscenaCine'
import './landing.css'

const DOMINIO = 'banco-ejemplo.es'
const ARC = 2 * Math.PI * 92
const PROG_ESTATICO = 0.76

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x
}
function seg(p: number, a: number, b: number): number {
  return clamp01((p - a) / (b - a))
}
function suave(p: number, a: number, b: number): number {
  const t = seg(p, a, b)
  return t * t * (3 - 2 * t)
}
function prefiereMenosMovimiento(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function esMovil(): boolean {
  return window.matchMedia('(max-width: 760px)').matches
}

// Los seis beats de la secuencia. El séptimo, la llamada a la acción, vive en la
// sección de cierre, ya fuera del plano fijado.
const CAPS: Array<{ t: number; ph: string; txt: string }> = [
  { t: 0.0, ph: '01 · Reconocimiento', txt: 'Así te ve un atacante.' },
  { t: 0.14, ph: '02 · El objetivo', txt: 'Un dominio. Todo lo que cuelga de él.' },
  { t: 0.32, ph: '03 · La superficie', txt: 'Todo lo que expones a internet, a la vez.' },
  { t: 0.48, ph: '04 · Puertas abiertas', txt: 'Cada puerto abierto es una entrada más.' },
  { t: 0.64, ph: '05 · Amenaza activa', txt: 'Lo que ya se está explotando ahí fuera.' },
  { t: 0.82, ph: '06 · Exposición', txt: 'Todo colapsa en una sola nota.' },
]

export function Landing({ onEntrar }: { onEntrar: () => void }) {
  const [estatico] = useState(prefiereMenosMovimiento)
  const [movil] = useState(esMovil)

  // Datos reales del motor: la cifra final y la densidad de la constelación de
  // amenaza salen de aquí, no de valores inventados.
  const datos = useMemo(() => {
    const superficie = superficieSembrada(DOMINIO)!
    const analisis = analizar(superficie)
    const grafo = construirGrafo(superficie)
    let descubribles = 0
    let amenazas = 0
    for (const n of grafo.nodos) {
      if (n.capa === 1 || n.capa === 2 || n.capa === 4) descubribles++
      if ((n.capa === 2 || n.capa === 4) && (n.kev || n.severidad === 'critica' || n.severidad === 'alta')) {
        amenazas++
      }
    }
    return { exp: analisis.exposicion, descubribles, amenazas }
  }, [])

  const { exp, descubribles, amenazas } = datos
  const colorNivel = COLOR_NIVEL[exp.nivel]
  const topVisible = exp.top.slice(0, 5)

  const tecleado = useTecleo(DOMINIO, !estatico)

  const scrollerRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const pintarHud = useRef<((p: number) => void) | null>(null)

  // Localiza los elementos del HUD una sola vez y define cómo reaccionan al
  // progreso. Lo llama la escena en cada fotograma, con el progreso ya suavizado.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const uno = <T extends Element>(sel: string) => stage.querySelector(sel) as T | null

    const tc = uno<HTMLElement>('[data-rol="tc"]')
    const caption = uno<HTMLElement>('[data-rol="caption"]')
    const phase = uno<HTMLElement>('[data-rol="phase"]')
    const countn = uno<HTMLElement>('[data-rol="countn"]')
    const scoreN = uno<SVGTextElement>('[data-rol="scoreN"]')
    const arc = uno<SVGCircleElement>('[data-rol="arc"]')
    const cockpit = uno<HTMLElement>('[data-rol="cockpit"]')
    const skip = uno<HTMLElement>('[data-rol="skip"]')
    const riel = [...stage.querySelectorAll<HTMLElement>('[data-rol="riel-btn"]')]

    let ultimoCap = -1
    const setCaption = (p: number) => {
      let idx = 0
      for (let i = 0; i < CAPS.length; i++) if (p >= CAPS[i].t) idx = i
      if (idx === ultimoCap) return
      ultimoCap = idx
      if (caption) {
        caption.style.opacity = '0'
        window.setTimeout(() => {
          caption.textContent = CAPS[idx].txt
          if (phase) phase.textContent = CAPS[idx].ph
          caption.style.opacity = '1'
        }, 160)
      }
    }

    const pintar = (p: number) => {
      if (tc) tc.textContent = timecode(p)
      if (countn) countn.textContent = String(Math.round(descubribles * suave(p, 0.1, 0.82)))

      const score = Math.round(exp.score * suave(p, 0.86, 1))
      if (scoreN) scoreN.textContent = String(score)
      if (arc) arc.setAttribute('stroke-dashoffset', String(ARC * (1 - score / 100)))

      const col = suave(p, 0.84, 0.99)
      if (cockpit) {
        cockpit.style.opacity = String(col)
        cockpit.style.transform = `translateY(${(1 - col) * 26}px) scale(${0.94 + col * 0.06})`
        cockpit.style.pointerEvents = col > 0.5 ? 'auto' : 'none'
      }

      if (skip) {
        const o = 1 - suave(p, 0.72, 0.9)
        skip.style.opacity = String(o)
        skip.style.pointerEvents = o > 0.5 ? 'auto' : 'none'
      }

      riel.forEach((b, i) => {
        const fin = i + 1 < CAPS.length ? CAPS[i + 1].t : 1
        b.style.setProperty('--p', String(seg(p, CAPS[i].t, fin)))
      })

      setCaption(p)
    }

    if (estatico) {
      // Fotograma fijo: todo montado y con las cifras reales, sin depender del
      // scroll. La escena ya pinta su keyframe; aquí dejamos el HUD en su estado
      // final.
      if (tc) tc.textContent = timecode(1)
      if (countn) countn.textContent = String(descubribles)
      if (scoreN) scoreN.textContent = String(exp.score)
      if (arc) arc.setAttribute('stroke-dashoffset', String(ARC * (1 - exp.score / 100)))
      if (cockpit) cockpit.style.opacity = '1'
      if (caption) caption.textContent = CAPS[CAPS.length - 1].txt
      if (phase) phase.textContent = CAPS[CAPS.length - 1].ph
      pintarHud.current = null
      return
    }

    pintarHud.current = pintar
    pintar(0)
    return () => {
      pintarHud.current = null
    }
  }, [estatico, descubribles, exp.score])

  const alProgreso = useCallback((p: number) => pintarHud.current?.(p), [])

  // Carga simulada de la secuencia: un arranque breve, independiente del scroll,
  // igual que la cinta "cargando" de las intros de cine.
  const loaderRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (estatico) return
    const el = loaderRef.current
    if (!el) return
    const barra = el.querySelector<HTMLElement>('.l-loader-barra')
    const txt = el.querySelector<HTMLElement>('.l-loader-txt')
    const inicio = performance.now()
    let raf = 0
    const paso = (ahora: number) => {
      const t = clamp01((ahora - inicio) / 1500)
      const pc = Math.round(t * 100)
      if (txt) txt.textContent = `Cargando secuencia ${pc}%`
      if (barra) barra.style.transform = `scaleX(${t})`
      if (t < 1) raf = requestAnimationFrame(paso)
      else window.setTimeout(() => el.classList.add('l-loader--fin'), 300)
    }
    raf = requestAnimationFrame(paso)
    return () => cancelAnimationFrame(raf)
  }, [estatico])

  const irATramo = useCallback(
    (fraccion: number) => {
      const comportamiento: ScrollBehavior = estatico ? 'auto' : 'smooth'
      const sc = scrollerRef.current
      if (!sc) {
        window.scrollTo({ top: document.body.scrollHeight, behavior: comportamiento })
        return
      }
      const top = sc.offsetTop + (sc.offsetHeight - window.innerHeight) * fraccion
      window.scrollTo({ top, behavior: comportamiento })
    },
    [estatico],
  )

  const enlaces = estatico
    ? []
    : [
        { texto: 'Superficie', alPulsar: () => irATramo(CAPS[2].t) },
        { texto: 'Amenaza', alPulsar: () => irATramo(CAPS[4].t) },
        { texto: 'Exposición', alPulsar: () => irATramo(CAPS[5].t) },
      ]

  const cockpit = (
    <div className="l-cockpit" data-rol="cockpit" style={{ opacity: estatico ? 1 : 0 }}>
      <div className="l-panel">
        <div className="gaugebox panel-glass">
          <span className="esq esq1" />
          <span className="esq esq2" />
          <span className="esq esq3" />
          <span className="esq esq4" />
          <h3>Nota de exposición</h3>
          <svg width="220" height="220" viewBox="0 0 220 220" className="gauge" style={{ '--nivel': colorNivel } as CSSProperties}>
            <circle cx="110" cy="110" r="92" fill="none" stroke="#1b2436" strokeWidth="14" />
            <circle
              data-rol="arc"
              cx="110"
              cy="110"
              r="92"
              fill="none"
              stroke={colorNivel}
              strokeWidth="14"
              strokeLinecap="round"
              transform="rotate(-90 110 110)"
              strokeDasharray={ARC}
              strokeDashoffset={estatico ? ARC * (1 - exp.score / 100) : ARC}
            />
            <text
              data-rol="scoreN"
              x="110"
              y="118"
              textAnchor="middle"
              className="gauge-num"
              fill={colorNivel}
              style={{ filter: `drop-shadow(0 0 18px ${colorNivel}66)` }}
            >
              {estatico ? exp.score : 0}
            </text>
            <text x="110" y="150" textAnchor="middle" className="gauge-sub">
              / 100 · {ETIQUETA_NIVEL[exp.nivel].toUpperCase()}
            </text>
          </svg>
          <div className="gauge-ctx">
            {exp.desglose.cvesKev} CVE en explotación activa sobre {exp.desglose.serviciosExpuestos} servicios expuestos
          </div>
        </div>
        <div className="l-bits">
          <div className="bar">
            Servicios expuestos a internet <b>{exp.desglose.serviciosExpuestos}</b>
          </div>
          <div className="bar">
            CVE en el catálogo KEV de CISA <b style={{ color: COLOR_NIVEL.critico }}>{exp.desglose.cvesKev}</b>
          </div>
          <div className="bar">
            Certificados por caducar <b style={{ color: COLOR_NIVEL.medio }}>{exp.desglose.certificadosPorCaducar}</b>
          </div>
          <div className="l-list panel-glass">
            <header>
              <span>Empieza por aquí · prioridad</span>
              <span>EPSS · KEV</span>
            </header>
            <div>
              {topVisible.map((h, i) => (
                <div className="l-row" key={h.cve + h.ip}>
                  <span className="rank">{i + 1}</span>
                  <span className="asset">
                    {h.cve}
                    <small>
                      {h.host} · {h.ip}
                    </small>
                  </span>
                  <PillSeveridad sev={h.severidad} />
                  <BadgeKev kev={h.kev} plazo={h.kevPlazo} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="landing">
      <EscenaCine
        scrollerRef={scrollerRef}
        estatico={estatico}
        movil={movil}
        nAmenazas={amenazas}
        onProgreso={alProgreso}
        progresoEstatico={PROG_ESTATICO}
      />

      <Cabecera onAccion={onEntrar} textoAccion="Iniciar análisis" enlaces={enlaces} />

      <section className="l-hero">
        <p className="eyebrow">Plataforma de evaluación de exposición · EASM + CTEM</p>
        <h1>
          Así te ve
          <br />
          un atacante
        </h1>
        <p className="l-hero-sub">
          Escribe un dominio y ATALAYA reconstruye, solo con fuentes pasivas, todo lo que tu organización expone a
          internet. Luego lo colapsa en una única nota de exposición, ya priorizada por riesgo real.
        </p>
        <div className="termwrap panel-glass">
          <div className="termbar">
            <i />
            <i />
            <i />
            <b>atalaya · recon pasivo</b>
          </div>
          <div className="term">
            <span className="pr">atalaya&nbsp;&gt;&nbsp;</span>
            <span className="ty">{tecleado}</span>
            <span className="caret" />
          </div>
        </div>
        <p className="l-hint">Desliza para ver qué expones</p>
      </section>

      {estatico ? (
        <section className="l-estatico">
          <div className="l-stage l-stage--estatico" ref={stageRef}>
            <div className="l-timecode" data-rol="tc">
              00:00:00:00 · SECUENCIA
            </div>
            <ol className="l-beats">
              {CAPS.map((c) => (
                <li key={c.ph}>
                  <span className="l-beats-ph">{c.ph}</span>
                  <span className="l-beats-txt">{c.txt}</span>
                </li>
              ))}
            </ol>
            <div className="l-count">
              <span>Elementos descubiertos</span>
              <b data-rol="countn">{descubribles}</b>
            </div>
            {cockpit}
            <div className="l-caption l-caption--estatico" data-rol="caption">
              {CAPS[CAPS.length - 1].txt}
            </div>
            <div className="l-phase l-phase--estatico" data-rol="phase">
              {CAPS[CAPS.length - 1].ph}
            </div>
          </div>
        </section>
      ) : (
        <section className="l-scroller" ref={scrollerRef}>
          <div className="l-stage" ref={stageRef}>
            <div className="l-rec" aria-hidden="true">
              <i />
              Rec
            </div>
            <div className="l-timecode" data-rol="tc">
              00:00:00:00 · SECUENCIA
            </div>
            <div className="l-count">
              <span>Elementos descubiertos</span>
              <b data-rol="countn">0</b>
            </div>

            {cockpit}

            <div className="l-caption" data-rol="caption">
              {CAPS[0].txt}
            </div>
            <div className="l-phase" data-rol="phase">
              {CAPS[0].ph}
            </div>

            <nav className="l-riel" aria-label="Capítulos de la secuencia">
              {CAPS.map((c, i) => (
                <button
                  key={c.ph}
                  type="button"
                  data-rol="riel-btn"
                  className="l-riel-btn"
                  aria-label={`Ir a ${c.ph}`}
                  onClick={() => irATramo(c.t)}
                >
                  <i />
                  <span>{c.ph}</span>
                  <em style={{ '--idx': i } as CSSProperties} />
                </button>
              ))}
            </nav>

            <div className="l-loader" data-rol="loader" ref={loaderRef} aria-hidden="true">
              <span className="l-loader-txt">Cargando secuencia 0%</span>
              <span className="l-loader-pista">
                <span className="l-loader-barra" />
              </span>
            </div>

            <button type="button" className="l-skip" data-rol="skip" onClick={() => irATramo(1)}>
              Saltar intro
            </button>
          </div>
        </section>
      )}

      <section className="l-outro">
        <p className="eyebrow">De todo esto, empieza por aquí</p>
        <h2>
          Prioriza por
          <br />
          riesgo real
        </h2>
        <p className="l-outro-sub">
          No por CVSS a secas. ATALAYA cruza la probabilidad de explotación (EPSS) y el catálogo KEV de CISA con lo
          crítico que es cada activo. Lo que pulsa en rojo es lo que ya se está usando en ataques ahí fuera.
        </p>
        <button type="button" className="boton-grande" onClick={onEntrar}>
          Probar la herramienta
        </button>
      </section>

      <footer className="l-foot">
        ATALAYA · datos de ejemplo sobre rangos de documentación (RFC 5737) · reconocimiento pasivo, sin tocar el objetivo
      </footer>
    </div>
  )
}
