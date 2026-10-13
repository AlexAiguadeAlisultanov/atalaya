// Shell de la herramienta: coordina buscador, estado de análisis y resultado,
// y carga una vez la lista de dominios demo y el estado del sistema. Es el
// trozo pesado de la app, por eso App lo carga en diferido.

import { useEffect, useState } from 'react'
import type { Analisis } from '../../engine'
import type { Estado, Uso } from '../../lib/api'
import { ErrorApi, analizarDominio, obtenerDominiosDemo, obtenerEstado } from '../../lib/api'
import type { FichaDominio } from '../../datos/sembrado'
import { Cabecera } from '../Cabecera'
import { FondoEstelar } from '../comunes/fondoEstelar/FondoEstelar'
import { Buscador } from './Buscador'
import { Resultado } from './Resultado'
import { EstadoSistema } from './EstadoSistema'
import { Osint } from '../osint/Osint'
import './herramienta.css'
import '../osint/osint.css'

type Fase = 'buscador' | 'analizando' | 'resultado'
type Apartado = 'exposicion' | 'osint'

export function Herramienta({ onSalir }: { onSalir: () => void }) {
  const [apartado, setApartado] = useState<Apartado>('exposicion')
  const [fase, setFase] = useState<Fase>('buscador')
  const [dominiosDemo, setDominiosDemo] = useState<FichaDominio[]>([])
  const [estado, setEstado] = useState<Estado | null>(null)
  const [uso, setUso] = useState<Uso | null>(null)
  const [analisis, setAnalisis] = useState<Analisis | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])
  const [error, setError] = useState<ErrorApi | null>(null)
  const [dominioEnCurso, setDominioEnCurso] = useState('')

  useEffect(() => {
    let vivo = true
    obtenerDominiosDemo().then((d) => vivo && setDominiosDemo(d)).catch(() => {})
    obtenerEstado()
      .then((e) => {
        if (!vivo) return
        setEstado(e)
        setUso(e.uso)
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  const analizar = async (dominio: string, consentimiento: boolean) => {
    setError(null)
    setDominioEnCurso(dominio)
    setFase('analizando')
    try {
      const resp = await analizarDominio(dominio, consentimiento)
      setAnalisis(resp.analisis)
      setAvisos(resp.avisos)
      if (resp.uso) setUso(resp.uso)
      setFase('resultado')
    } catch (e) {
      const err = e instanceof ErrorApi ? e : new ErrorApi('desconocido', 'El análisis no se pudo completar.', 0)
      if (err.uso) setUso(err.uso)
      setError(err)
      setFase('buscador')
    }
  }

  const volverBuscador = () => {
    setAnalisis(null)
    setAvisos([])
    setFase('buscador')
  }

  return (
    <div className="herramienta">
      <FondoEstelar />
      <Cabecera onMarca={onSalir} onAccion={onSalir} textoAccion="Portada" />

      <main className="herramienta-cuerpo">
        <div className="apartado-conmutador no-imprimir">
          <div className="apartado-tabs" role="tablist" aria-label="Apartados de la herramienta">
            <button
              type="button"
              role="tab"
              aria-selected={apartado === 'exposicion'}
              className={`apartado-tab${apartado === 'exposicion' ? ' apartado-tab--activo' : ''}`}
              onClick={() => setApartado('exposicion')}
            >
              Exposición
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={apartado === 'osint'}
              className={`apartado-tab${apartado === 'osint' ? ' apartado-tab--activo' : ''}`}
              onClick={() => setApartado('osint')}
            >
              OSINT
            </button>
          </div>
        </div>

        {apartado === 'osint' ? (
          <Osint />
        ) : fase === 'resultado' && analisis ? (
          <Resultado analisis={analisis} avisos={avisos} onVolver={volverBuscador} />
        ) : fase === 'analizando' ? (
          <Analizando dominio={dominioEnCurso} />
        ) : (
          <Buscador
            dominiosDemo={dominiosDemo}
            uso={uso}
            cargando={false}
            error={error}
            onAnalizar={analizar}
          />
        )}
      </main>

      <footer className="herramienta-pie">
        <EstadoSistema estado={estado} />
      </footer>
    </div>
  )
}

function Analizando({ dominio }: { dominio: string }) {
  return (
    <div className="analizando" role="status" aria-live="polite">
      <div className="analizando-term panel-glass">
        <div className="termbar"><i /><i /><i /><b>atalaya · recon pasivo</b></div>
        <div className="analizando-lineas mono">
          <div><span className="pr">atalaya&nbsp;&gt;&nbsp;</span>{dominio}</div>
          <div className="analizando-paso">reuniendo subdominios, resolviendo IPs y cruzando CVE con KEV y EPSS…</div>
          <div className="analizando-barra"><span /></div>
        </div>
      </div>
      <p className="analizando-nota">
        Un dominio de demostración vuelve al instante. Un análisis en vivo depende de fuentes externas y
        puede tardar algunos segundos.
      </p>
    </div>
  )
}
