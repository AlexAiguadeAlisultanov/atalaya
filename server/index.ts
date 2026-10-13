// API de ATALAYA. Hace de proxy de las fuentes pasivas (el navegador nunca las
// llama) y, en producción, sirve también el front ya compilado. En desarrollo,
// Vite sirve el front y redirige /api aquí.

import { env } from 'node:process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import express from 'express'
import type { Request } from 'express'
import { BACKEND_CACHE, cacheCuenta } from './cache'
import { analizarSembrado, analizarVivo } from './analizar'
import { DOMINIOS_DEMO, esDominioDemo } from '../src/datos/sembrado'
import { consumir, estadoUso, LIMITE_DIARIO } from './uso'
import { pivotar } from './osint/pivot'
import { CASOS_DEMO_OSINT, esCasoDemoOsint, osintSembrado } from '../src/datos/osint-sembrado'
import { detectarTipo, normalizarValor, semillaValida } from '../src/engine/osint/normalizar'
import type { TipoEntidad } from '../src/engine/osint/tipos'

const VERSION = '0.1.0'
const PUERTO = Number.parseInt(env.PORT ?? '3099', 10)

const DOMINIO_RE = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/

/** Normaliza lo que teclea el usuario a un dominio limpio, o null si no es válido. */
function normalizarDominio(bruto: unknown): string | null {
  if (typeof bruto !== 'string') return null
  let d = bruto.trim().toLowerCase()
  d = d.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/\.$/, '')
  return DOMINIO_RE.test(d) ? d : null
}

function cliente(req: Request): string {
  return req.ip ?? 'desconocido'
}

function hoy(): string {
  return new Date().toISOString().slice(0, 10)
}

const app = express()
app.set('trust proxy', 1) // Render y similares van detrás de un proxy
app.use(express.json({ limit: '32kb' }))

app.get('/api/salud', (_req, res) => {
  res.json({ ok: true, version: VERSION, base: BACKEND_CACHE, entradasCache: cacheCuenta() })
})

app.get('/api/estado', (req, res) => {
  res.json({
    version: VERSION,
    base: BACKEND_CACHE,
    entradasCache: cacheCuenta(),
    nvdConClave: Boolean(env.ATALAYA_NVD_KEY),
    limiteDiario: LIMITE_DIARIO,
    uso: estadoUso(cliente(req), hoy()),
    fuentes: [
      { id: 'crtsh', nombre: 'crt.sh (transparencia de certificados)', clave: false },
      { id: 'hackertarget', nombre: 'HackerTarget (hostsearch, respaldo)', clave: false },
      { id: 'dns', nombre: 'DNS-over-HTTPS (Cloudflare)', clave: false },
      { id: 'internetdb', nombre: 'Shodan InternetDB (puertos y servicios)', clave: false },
      { id: 'cvedb', nombre: 'Shodan CVEDB (CVSS + EPSS + KEV)', clave: false },
      { id: 'kev', nombre: 'CISA KEV (plazos de remediación)', clave: false },
      { id: 'nvd', nombre: 'NVD (CVSS autoritativo, opcional)', clave: Boolean(env.ATALAYA_NVD_KEY) },
    ],
  })
})

app.get('/api/dominios-demo', (_req, res) => {
  res.json({ dominios: DOMINIOS_DEMO })
})

app.get('/api/uso', (req, res) => {
  res.json(estadoUso(cliente(req), hoy()))
})

app.post('/api/analizar', async (req, res) => {
  const dominio = normalizarDominio(req.body?.dominio)
  if (!dominio) {
    res.status(400).json({ error: 'dominio_invalido', mensaje: 'Escribe un dominio válido, por ejemplo empresa.es.' })
    return
  }

  // Camino de demostración: datos sembrados, instantáneo y sin gastar cuota.
  if (esDominioDemo(dominio)) {
    res.json({ analisis: analizarSembrado(dominio, new Date().toISOString()), avisos: [], demo: true })
    return
  }

  // Dominio propio del usuario: exige consentimiento explícito (solo recon pasivo).
  if (req.body?.consentimiento !== true) {
    res.status(403).json({
      error: 'consentimiento_requerido',
      mensaje:
        'Para analizar un dominio que no es de demostración debes confirmar que tienes permiso. ATALAYA solo hace reconocimiento pasivo (consulta fuentes públicas, no toca el objetivo).',
    })
    return
  }

  const uso = consumir(cliente(req), hoy())
  if (!uso.permitido) {
    res.status(429).json({
      error: 'limite_diario',
      mensaje: `Has llegado al límite de ${uso.limite} análisis en vivo por hoy. Los dominios de demostración no gastan cuota.`,
      uso,
    })
    return
  }

  try {
    const { analisis, avisos } = await analizarVivo(dominio, new Date().toISOString())
    res.json({ analisis, avisos, demo: false, uso })
  } catch (e) {
    res.status(502).json({ error: 'fuentes_no_disponibles', mensaje: 'No se pudo completar el análisis: ' + (e as Error).message })
  }
})

// ----- OSINT: pivoteo sobre fuentes públicas -----

app.get('/api/osint/demo', (_req, res) => {
  res.json({ casos: CASOS_DEMO_OSINT })
})

const TIPOS_SEMILLA: TipoEntidad[] = ['email', 'usuario', 'dominio', 'ip']

app.post('/api/osint', async (req, res) => {
  const bruto = req.body?.semillas
  if (!Array.isArray(bruto) || bruto.length === 0) {
    res.status(400).json({ error: 'semillas_requeridas', mensaje: 'Añade al menos un dato para investigar: email, usuario, dominio o IP.' })
    return
  }

  const semillas: Array<{ tipo: TipoEntidad; valor: string }> = []
  for (const s of bruto.slice(0, 5)) {
    const valor = typeof s?.valor === 'string' ? s.valor.trim() : ''
    if (!valor) continue
    const tipo = (s?.tipo as TipoEntidad) || detectarTipo(valor) || undefined
    if (!tipo || !TIPOS_SEMILLA.includes(tipo)) continue
    if (!semillaValida(tipo, valor)) continue
    const norm = normalizarValor(tipo, valor)
    if (!semillas.some((x) => x.tipo === tipo && x.valor === norm)) semillas.push({ tipo, valor: norm })
  }

  if (semillas.length === 0) {
    res.status(400).json({ error: 'semillas_invalidas', mensaje: 'Ninguno de los datos es válido. Usa un email, un usuario, un dominio o una IP.' })
    return
  }

  // Caso de demostración: datos sembrados, instantáneo y sin gastar cuota.
  if (esCasoDemoOsint(semillas)) {
    res.json({ resultado: osintSembrado(new Date().toISOString()), demo: true })
    return
  }

  // Investigación real: exige consentimiento (OSINT sobre personas es sensible).
  if (req.body?.consentimiento !== true) {
    res.status(403).json({
      error: 'consentimiento_requerido',
      mensaje:
        'OSINT solo consulta fuentes públicas y pasivas, pero debes confirmar que tienes autorización para investigar estos datos.',
    })
    return
  }

  const uso = consumir(cliente(req), hoy())
  if (!uso.permitido) {
    res.status(429).json({
      error: 'limite_diario',
      mensaje: `Has llegado al límite de ${uso.limite} investigaciones en vivo por hoy. El caso de demostración no gasta cuota.`,
      uso,
    })
    return
  }

  try {
    const resultado = await pivotar(semillas, new Date().toISOString())
    res.json({ resultado, demo: false, uso })
  } catch (e) {
    res.status(502).json({ error: 'fuentes_no_disponibles', mensaje: 'No se pudo completar la investigación: ' + (e as Error).message })
  }
})

// ----- Estáticos del front compilado (solo si existe dist/) -----
const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(raiz, 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/')) {
      res.sendFile(path.join(dist, 'index.html'))
    } else {
      next()
    }
  })
}

app.listen(PUERTO, () => {
  console.log(`ATALAYA API escuchando en http://localhost:${PUERTO} (caché: ${BACKEND_CACHE})`)
})
