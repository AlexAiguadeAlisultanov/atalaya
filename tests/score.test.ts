import { describe, it, expect } from 'vitest'
import {
  analizar,
  calcularExposicion,
  nivelDeScore,
  priorizar,
  puntuacionRiesgo,
  severidadDeCvss,
} from '../src/engine/score'
import type { Hallazgo, SuperficieAtaque } from '../src/engine/tipos'

function superficieMinima(): SuperficieAtaque {
  return {
    dominio: 'test.es',
    generadoEn: '2026-01-01T00:00:00.000Z',
    modo: 'sembrado',
    parcial: false,
    fuentes: [],
    subdominios: [{ nombre: 'www.test.es', ips: ['203.0.113.1'], origen: ['dns'] }],
    activos: [
      {
        ip: '203.0.113.1',
        tipo: 'ipv4',
        hosts: ['www.test.es'],
        servicios: [
          {
            puerto: 443,
            protocolo: 'tcp',
            nombre: 'https',
            cves: [{ id: 'CVE-2021-44228', cvss: 10, epss: 0.97, kev: true }],
          },
        ],
      },
    ],
  }
}

describe('severidadDeCvss', () => {
  it('respeta las bandas estándar de CVSS', () => {
    expect(severidadDeCvss(9.8)).toBe('critica')
    expect(severidadDeCvss(7.0)).toBe('alta')
    expect(severidadDeCvss(4.0)).toBe('media')
    expect(severidadDeCvss(0.1)).toBe('baja')
    expect(severidadDeCvss(0)).toBe('info')
  })
})

describe('puntuacionRiesgo', () => {
  const base = { cvss: 7, epss: 0.1, kev: false, puerto: 443, host: 'www.test.es' }

  it('está acotada a 0..100', () => {
    const alto = puntuacionRiesgo({ cvss: 10, epss: 1, kev: true, puerto: 22, host: 'vpn.test.es' })
    expect(alto.valor).toBeLessThanOrEqual(100)
    expect(alto.valor).toBeGreaterThanOrEqual(0)
  })

  it('KEV sube la puntuación', () => {
    const sin = puntuacionRiesgo(base)
    const con = puntuacionRiesgo({ ...base, kev: true })
    expect(con.valor).toBeGreaterThan(sin.valor)
  })

  it('más EPSS sube la puntuación', () => {
    const bajo = puntuacionRiesgo({ ...base, epss: 0.1 })
    const alto = puntuacionRiesgo({ ...base, epss: 0.9 })
    expect(alto.valor).toBeGreaterThan(bajo.valor)
  })

  it('un puerto sensible aporta una razón', () => {
    const r = puntuacionRiesgo({ ...base, puerto: 3389 })
    expect(r.razones.some((x) => /RDP|remoto/i.test(x))).toBe(true)
  })
})

describe('priorizar', () => {
  it('a igualdad de puntuación, KEV va primero', () => {
    const h: Hallazgo[] = [
      { cve: 'CVE-A', ip: '1', host: 'a', servicio: 'https:443', severidad: 'alta', cvss: 7, epss: 0.5, kev: false, puntuacionRiesgo: 50, razones: [] },
      { cve: 'CVE-B', ip: '1', host: 'a', servicio: 'https:443', severidad: 'alta', cvss: 7, epss: 0.5, kev: true, puntuacionRiesgo: 50, razones: [] },
    ]
    expect(priorizar(h)[0].cve).toBe('CVE-B')
  })

  it('ordena de mayor a menor puntuación', () => {
    const { top } = calcularExposicion(superficieMinima())
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1].puntuacionRiesgo).toBeGreaterThanOrEqual(top[i].puntuacionRiesgo)
    }
  })
})

describe('calcularExposicion', () => {
  it('superficie vacía da score 0 y nivel bajo', () => {
    const vacia: SuperficieAtaque = { ...superficieMinima(), subdominios: [], activos: [] }
    const exp = calcularExposicion(vacia)
    expect(exp.score).toBe(0)
    expect(exp.nivel).toBe('bajo')
  })

  it('un CVE crítico y explotado da exposición crítica', () => {
    const exp = calcularExposicion(superficieMinima())
    expect(exp.score).toBeGreaterThanOrEqual(80)
    expect(exp.nivel).toBe('critico')
  })

  it('el desglose cuenta KEV y servicios', () => {
    const { desglose } = calcularExposicion(superficieMinima())
    expect(desglose.serviciosExpuestos).toBe(1)
    expect(desglose.cvesTotal).toBe(1)
    expect(desglose.cvesKev).toBe(1)
  })
})

describe('nivelDeScore', () => {
  it('mapea los tramos', () => {
    expect(nivelDeScore(85)).toBe('critico')
    expect(nivelDeScore(65)).toBe('alto')
    expect(nivelDeScore(40)).toBe('medio')
    expect(nivelDeScore(10)).toBe('bajo')
  })
})

describe('determinismo', () => {
  it('analizar dos veces da exactamente lo mismo', () => {
    const a = analizar(superficieMinima())
    const b = analizar(superficieMinima())
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
