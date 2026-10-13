// NVD (National Vulnerability Database). De un id de CVE saca su puntuación base
// CVSS y su descripción. Tiene un límite estricto sin clave (5 peticiones / 30 s),
// así que cacheamos 30 días y serializamos las llamadas con un intervalo mínimo.
// Si defines ATALAYA_NVD_KEY, el límite sube y el intervalo baja.

import { env } from 'node:process'
import { cacheObtener, cacheGuardar } from '../cache'
import { ErrorFuente, esperar, obtenerJson } from '../http'

export interface DatosCve {
  cvss: number
  descripcion?: string
}

interface RespuestaNvd {
  vulnerabilities?: Array<{
    cve: {
      id: string
      descriptions?: Array<{ lang: string; value: string }>
      metrics?: {
        cvssMetricV31?: Array<{ cvssData: { baseScore: number } }>
        cvssMetricV30?: Array<{ cvssData: { baseScore: number } }>
        cvssMetricV2?: Array<{ cvssData: { baseScore: number } }>
      }
    }
  }>
}

const TTL = 30 * 24 * 3600
const CLAVE_API = env.ATALAYA_NVD_KEY
const INTERVALO_MS = CLAVE_API ? 700 : 6500

let proximoPermitido = 0

async function respetarLimite(): Promise<void> {
  const ahora = Date.now()
  if (ahora < proximoPermitido) await esperar(proximoPermitido - ahora)
  proximoPermitido = Date.now() + INTERVALO_MS
}

function extraerCvss(r: RespuestaNvd): { cvss: number; descripcion?: string } | undefined {
  const v = r.vulnerabilities?.[0]?.cve
  if (!v) return undefined
  const m = v.metrics
  const base =
    m?.cvssMetricV31?.[0]?.cvssData.baseScore ??
    m?.cvssMetricV30?.[0]?.cvssData.baseScore ??
    m?.cvssMetricV2?.[0]?.cvssData.baseScore
  const descripcion = v.descriptions?.find((d) => d.lang === 'en')?.value
  return { cvss: base ?? 0, descripcion }
}

/** CVSS + descripción de un CVE. Devuelve cvss 0 si NVD no lo conoce o falla. */
export async function datosDeCve(id: string): Promise<DatosCve> {
  const cveId = id.toUpperCase()
  const clave = `nvd:${cveId}`
  const guardado = cacheObtener<DatosCve>(clave)
  if (guardado !== undefined) return guardado

  await respetarLimite()
  try {
    const url = `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`
    const r = await obtenerJson<RespuestaNvd>('nvd', url, {
      timeoutMs: 12000,
      headers: CLAVE_API ? { apiKey: CLAVE_API } : {},
    })
    const datos = extraerCvss(r) ?? { cvss: 0 }
    cacheGuardar(clave, datos, TTL)
    return datos
  } catch (e) {
    // Ante rate-limit o caída puntual, no cacheamos el fallo: devolvemos 0 y se
    // reintentará en el próximo análisis.
    if (e instanceof ErrorFuente) return { cvss: 0 }
    throw e
  }
}
