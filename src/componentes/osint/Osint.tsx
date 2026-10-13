// Shell del apartado OSINT: coordina la entrada, el estado de la investigación y
// el resultado, y carga una vez el caso de demostración y la cuota del día. Vive
// dentro de la herramienta, así que hereda su fondo y su cabecera.

import { useEffect, useState } from 'react'
import type { CasoDemoOsint } from '../../datos/osint-sembrado'
import type { ResultadoOsint as ResultadoOsintTipo } from '../../engine/osint/tipos'
import { obtenerUso } from '../../lib/api'
import {
  ErrorOsint,
  investigar,
  obtenerCasosDemoOsint,
  type SemillaOsint,
  type UsoOsint,
} from '../../lib/osintApi'
import { EntradaOsint } from './EntradaOsint'
import { ResultadoOsint } from './ResultadoOsint'
import { DossierOsint } from './DossierOsint'

type Fase = 'entrada' | 'investigando' | 'resultado' | 'dossier'

export function Osint() {
  const [fase, setFase] = useState<Fase>('entrada')
  const [casos, setCasos] = useState<CasoDemoOsint[]>([])
  const [uso, setUso] = useState<UsoOsint | null>(null)
  const [resultado, setResultado] = useState<ResultadoOsintTipo | null>(null)
  const [error, setError] = useState<ErrorOsint | null>(null)
  const [enVivo, setEnVivo] = useState(false)

  useEffect(() => {
    let vivo = true
    obtenerCasosDemoOsint()
      .then((c) => vivo && setCasos(c))
      .catch(() => {})
    obtenerUso()
      .then((u) => vivo && setUso(u))
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  const lanzar = async (semillas: SemillaOsint[], consentimiento: boolean, vivo: boolean) => {
    setError(null)
    setEnVivo(vivo)
    setFase('investigando')
    try {
      const resp = await investigar(semillas, consentimiento)
      if (resp.uso) setUso(resp.uso)
      setResultado(resp.resultado)
      setFase('resultado')
    } catch (e) {
      const err = e instanceof ErrorOsint ? e : new ErrorOsint('desconocido', 'La investigación no se pudo completar.', 0)
      if (err.uso) setUso(err.uso)
      setError(err)
      setFase('entrada')
    }
  }

  const investigarEnVivo = (semillas: SemillaOsint[], consentimiento: boolean) =>
    lanzar(semillas, consentimiento, true)

  // El caso de demostración no gasta cuota y vuelve al instante; no exige consentimiento.
  const cargarDemo = (caso: CasoDemoOsint) => lanzar([caso.semilla], false, false)

  const volver = () => {
    setResultado(null)
    setFase('entrada')
  }

  if (fase === 'dossier' && resultado) {
    return <DossierOsint resultado={resultado} onVolver={() => setFase('resultado')} />
  }
  if (fase === 'resultado' && resultado) {
    return <ResultadoOsint resultado={resultado} onVolver={volver} onVerDossier={() => setFase('dossier')} />
  }
  if (fase === 'investigando') {
    return <Investigando enVivo={enVivo} />
  }
  return (
    <EntradaOsint
      casos={casos}
      uso={uso}
      cargando={false}
      error={error}
      onInvestigar={investigarEnVivo}
      onCargarDemo={cargarDemo}
    />
  )
}

function Investigando({ enVivo }: { enVivo: boolean }) {
  return (
    <div className="analizando" role="status" aria-live="polite">
      <div className="analizando-term panel-glass">
        <div className="termbar">
          <i />
          <i />
          <i />
          <b>atalaya · osint pasivo</b>
        </div>
        <div className="analizando-lineas mono">
          <div>
            <span className="pr">atalaya&nbsp;&gt;&nbsp;</span>pivotando por fuentes públicas
          </div>
          <div className="analizando-paso">
            cruzando identidad, cuentas, filtraciones, dominio e infraestructura…
          </div>
          <div className="analizando-barra">
            <span />
          </div>
        </div>
      </div>
      <p className="analizando-nota">
        {enVivo
          ? 'Una investigación en vivo depende de fuentes externas y puede tardar algunos segundos.'
          : 'El caso de demostración vuelve al instante.'}
      </p>
    </div>
  )
}
