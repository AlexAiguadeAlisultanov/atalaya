// Raíz de ATALAYA. Decide qué se ve, la portada o la herramienta, y mantiene
// las capas de ambiente detrás de todo. La herramienta (con el grafo y el
// cockpit) se carga en diferido para que la portada arranque ligera.

import { Suspense, lazy, useEffect, useState } from 'react'
import { Fondo } from './componentes/comunes/Fondo'
import { Landing } from './componentes/landing/Landing'

const Herramienta = lazy(() =>
  import('./componentes/herramienta/Herramienta').then((m) => ({ default: m.Herramienta })),
)

type Vista = 'landing' | 'herramienta'

export default function App() {
  const [vista, setVista] = useState<Vista>('landing')

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [vista])

  return (
    <>
      <Fondo />
      {vista === 'landing' ? (
        <Landing onEntrar={() => setVista('herramienta')} />
      ) : (
        <Suspense fallback={<div className="cargando-vista">Cargando herramienta…</div>}>
          <Herramienta onSalir={() => setVista('landing')} />
        </Suspense>
      )}
    </>
  )
}
