// Paleta de severidad y de nivel de exposición. Es la MISMA escala en todos los
// sitios donde aparece color (nodos del grafo, pills, bordes, gauge), para que
// un rojo signifique siempre lo mismo. Los valores salen del sistema visual del
// proyecto; aquí solo se mapean a cada estado del dominio.

import type { NivelExposicion, Severidad } from '../engine'

export const COLOR_SEVERIDAD: Record<Severidad, string> = {
  critica: '#FF2D55',
  alta: '#FF6B35',
  media: '#F5A524',
  baja: '#3B82F6',
  info: '#00E6A0',
}

export const ETIQUETA_SEVERIDAD: Record<Severidad, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
  info: 'Informativa',
}

// El nivel de exposición reusa la misma escala: cuanto peor es la foto, más
// caliente es el color. Una exposición baja se pinta en verde (lo bueno).
export const COLOR_NIVEL: Record<NivelExposicion, string> = {
  critico: '#FF2D55',
  alto: '#FF6B35',
  medio: '#F5A524',
  bajo: '#00E6A0',
}

export const ETIQUETA_NIVEL: Record<NivelExposicion, string> = {
  critico: 'Crítico',
  alto: 'Alto',
  medio: 'Medio',
  bajo: 'Bajo',
}
