// Paleta y rótulos del apartado OSINT. Los nodos se colorean por TIPO de entidad,
// no por severidad. Tonos fríos y coherentes con el HUD (anclados en el violeta
// del proyecto) para que un solo color grite: la BRECHA va en el rojo de
// severidad, porque es lo expuesto. El resto son familias del mismo sistema.

import type { Confianza, TipoEntidad } from '../../engine/osint/tipos'

export const COLOR_TIPO: Record<TipoEntidad, string> = {
  email: '#7c5cff', // acento del proyecto: suele ser la semilla
  usuario: '#9b82ff', // pariente directo del email
  persona: '#00e6a0', // la identidad, el "quién"
  cuenta: '#4c9bff', // un perfil en un servicio
  dominio: '#36d0e0', // infraestructura, aún frío
  ip: '#7e8ca8', // acero: fontanería de red
  organizacion: '#c08cff', // proveedor, registrador, empresa
  telefono: '#43be9c', // contacto
  brecha: '#ff2d55', // lo malo: el único rojo de severidad
}

export const ETIQUETA_TIPO: Record<TipoEntidad, string> = {
  email: 'Email',
  usuario: 'Usuario',
  dominio: 'Dominio',
  ip: 'IP',
  cuenta: 'Cuenta',
  brecha: 'Brecha',
  persona: 'Persona',
  organizacion: 'Organización',
  telefono: 'Teléfono',
}

export const ETIQUETA_TIPO_PLURAL: Record<TipoEntidad, string> = {
  email: 'Emails',
  usuario: 'Usuarios',
  dominio: 'Dominios',
  ip: 'IPs',
  cuenta: 'Cuentas',
  brecha: 'Brechas',
  persona: 'Personas',
  organizacion: 'Organizaciones',
  telefono: 'Teléfonos',
}

// Orden de lectura del resumen: primero el "quién", luego sus rastros, y la
// brecha arriba porque es lo que enciende la alarma.
export const ORDEN_RESUMEN: TipoEntidad[] = [
  'persona',
  'brecha',
  'cuenta',
  'dominio',
  'organizacion',
  'ip',
  'usuario',
  'telefono',
  'email',
]

export const COLOR_CONFIANZA: Record<Confianza, string> = {
  alta: '#00e6a0',
  media: '#9b82ff',
  baja: '#5a6478',
}

export const ETIQUETA_CONFIANZA: Record<Confianza, string> = {
  alta: 'Confianza alta',
  media: 'Confianza media',
  baja: 'Confianza baja',
}

// Rótulos legibles para las claves de meta que llegan de las fuentes.
const META_ROTULO: Record<string, string> = {
  ubicacion: 'Ubicación',
  registrado: 'Registrado',
  expira: 'Expira',
  fecha: 'Fecha de la filtración',
  registros: 'Registros filtrados',
  pais: 'País',
  puertos: 'Puertos abiertos',
  cves: 'CVE conocidas',
  servicio: 'Servicio',
  url: 'Enlace',
  rol: 'Rol',
}

export function rotuloMeta(clave: string): string {
  return META_ROTULO[clave] ?? clave.charAt(0).toUpperCase() + clave.slice(1)
}

/** Da formato a los valores de meta: agrupa miles en los recuentos largos. */
export function valorMeta(clave: string, valor: string): string {
  if (clave === 'registros' && /^\d+$/.test(valor)) {
    return new Intl.NumberFormat('es-ES').format(Number(valor))
  }
  return valor
}
