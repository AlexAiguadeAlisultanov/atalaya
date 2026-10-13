// Formateadores pequeños y compartidos. Nada de dependencias: Intl y aritmética.

/** EPSS viene en 0..1; lo mostramos como porcentaje entero, que es como se lee. */
export function porcentajeEpss(epss: number): string {
  return `${Math.round(epss * 100)}%`
}

export function cvssTexto(cvss: number): string {
  return cvss.toFixed(1)
}

/** Fecha ISO a algo legible en español, p. ej. "1 oct 2026". */
export function fechaCorta(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

/** Días restantes de un certificado a texto honesto (puede estar caducado). */
export function certificadoTexto(dias: number): string {
  if (dias < 0) return `caducado hace ${Math.abs(dias)} d`
  if (dias === 0) return 'caduca hoy'
  return `caduca en ${dias} d`
}

/** Timecode de cinta de vídeo para la portada: 00:MM:SS:FF a partir de 0..1. */
export function timecode(progreso: number): string {
  const total = Math.round(progreso * 220)
  const ff = total % 30
  const ss = Math.floor(total / 30) % 60
  const mm = Math.floor(total / 1800)
  const z = (n: number) => (n < 10 ? '0' : '') + n
  return `00:${z(mm)}:${z(ss)}:${z(ff)} · SECUENCIA`
}
