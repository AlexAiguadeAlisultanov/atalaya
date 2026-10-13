// Detección y normalización de semillas OSINT. El usuario puede elegir el tipo a
// mano en la interfaz; esto es el respaldo que adivina el tipo de lo que escribe
// y deja un valor limpio para construir ids de entidad estables.

import type { TipoEntidad } from './tipos'

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RE_IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/
const RE_DOMINIO = /^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/
const RE_TELEFONO = /^\+?[\d][\d\s().-]{6,}$/
const RE_USUARIO = /^[a-z0-9._-]{2,40}$/

/** Adivina el tipo de una semilla, o null si no encaja en nada reconocible. */
export function detectarTipo(bruto: string): TipoEntidad | null {
  const v = bruto.trim().toLowerCase()
  if (!v) return null
  if (RE_EMAIL.test(v)) return 'email'
  if (RE_IPV4.test(v)) return 'ip'
  if (RE_DOMINIO.test(v)) return 'dominio'
  if (RE_TELEFONO.test(bruto.trim()) && bruto.replace(/\D/g, '').length >= 7) return 'telefono'
  if (RE_USUARIO.test(v)) return 'usuario'
  return null
}

/** Deja el valor en forma canónica según su tipo. */
export function normalizarValor(tipo: TipoEntidad, bruto: string): string {
  const v = bruto.trim().toLowerCase()
  switch (tipo) {
    case 'dominio':
      return v.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/:\d+$/, '').replace(/\.$/, '')
    case 'telefono':
      return '+' + bruto.replace(/\D/g, '')
    default:
      return v
  }
}

export function idEntidad(tipo: TipoEntidad, valor: string): string {
  return `${tipo}:${valor}`
}

/** Valida que una semilla sea aceptable para su tipo declarado. */
export function semillaValida(tipo: TipoEntidad, valor: string): boolean {
  const v = valor.trim().toLowerCase()
  switch (tipo) {
    case 'email':
      return RE_EMAIL.test(v)
    case 'ip':
      return RE_IPV4.test(v)
    case 'dominio':
      return RE_DOMINIO.test(normalizarValor('dominio', valor))
    case 'usuario':
      return RE_USUARIO.test(v)
    case 'telefono':
      return valor.replace(/\D/g, '').length >= 7
    default:
      return false
  }
}
