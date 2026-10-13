import { describe, it, expect } from 'vitest'
import { construirInforme } from '../src/engine/osint/informe'
import { osintSembrado } from '../src/datos/osint-sembrado'

const inf = construirInforme(osintSembrado('2026-10-13T08:00:00.000Z'))

describe('construirInforme', () => {
  it('cuenta todas las entidades', () => {
    const total = inf.conteo.reduce((a, c) => a + c.n, 0)
    expect(total).toBe(inf.totalEntidades)
    expect(inf.totalEntidades).toBeGreaterThan(10)
  })

  it('arma una identidad con sus cuentas y correos', () => {
    expect(inf.identidades.length).toBeGreaterThan(0)
    const alex = inf.identidades[0]
    expect(alex.persona).toBeTruthy()
    expect(alex.cuentas.length).toBeGreaterThan(0)
    expect(alex.emails.length).toBeGreaterThan(0)
  })

  it('recoge brechas y el correo expuesto', () => {
    expect(inf.exposicion.brechas.length).toBeGreaterThan(0)
    expect(inf.exposicion.emailsExpuestos.length).toBeGreaterThan(0)
  })

  it('organiza la infraestructura del dominio cabecera', () => {
    const b = inf.infraestructura.find((x) => x.dominio === 'nube-ejemplo.es')!
    expect(b).toBeTruthy()
    expect(b.subdominios.length).toBeGreaterThan(0)
    expect(b.ips.length).toBeGreaterThan(0)
    expect(b.correo.length + b.dns.length).toBeGreaterThan(0)
  })

  it('conecta los puntos (multi-fuente y pivote) y saca hallazgos clave', () => {
    expect(inf.conexiones.some((c) => c.tipo === 'multi-fuente')).toBe(true)
    expect(inf.conexiones.some((c) => c.tipo === 'pivote')).toBe(true)
    expect(inf.hallazgosClave.length).toBeGreaterThan(0)
    // ordenados por severidad descendente
    const peso = { alta: 3, media: 2, baja: 1 }
    for (let i = 1; i < inf.hallazgosClave.length; i++) {
      expect(peso[inf.hallazgosClave[i - 1].severidad]).toBeGreaterThanOrEqual(peso[inf.hallazgosClave[i].severidad])
    }
  })

  it('ordena la cronología por fecha', () => {
    for (let i = 1; i < inf.cronologia.length; i++) {
      expect(inf.cronologia[i - 1].fecha <= inf.cronologia[i].fecha).toBe(true)
    }
  })

  it('es determinista', () => {
    const otra = construirInforme(osintSembrado('2026-10-13T08:00:00.000Z'))
    expect(JSON.stringify(otra)).toBe(JSON.stringify(inf))
  })
})
