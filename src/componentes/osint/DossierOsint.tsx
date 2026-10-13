// Dossier OSINT: junta TODO lo recopilado, ya conectado y organizado por el motor
// de informe (construirInforme), en un documento legible y listo para exportar a
// PDF. "Exportar PDF" usa la impresión del navegador (misma vía que el informe de
// Exposición): la hoja de impresión lo deja en blanco limpio.

import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { construirInforme } from '../../engine/osint/informe'
import type { ResultadoOsint as ResultadoOsintTipo } from '../../engine/osint/tipos'
import { fechaCorta } from '../../lib/formato'
import { Icono } from '../comunes/Icono'

export function DossierOsint({
  resultado,
  onVolver,
}: {
  resultado: ResultadoOsintTipo
  onVolver: () => void
}) {
  const inf = useMemo(() => construirInforme(resultado), [resultado])
  const semillaTxt = inf.semillas.map((s) => s.valor).join(', ')

  return (
    <div className="dossier">
      <div className="dossier-barra no-imprimir">
        <button type="button" className="boton-sec" onClick={onVolver}>
          <Icono nombre="flecha-izq" tam={15} /> Volver al mapa
        </button>
        <button type="button" className="boton" onClick={() => window.print()}>
          <Icono nombre="descargar" tam={15} /> Exportar PDF
        </button>
      </div>

      <article className="dossier-doc">
        <header className="dossier-cab">
          <p className="dossier-marca mono">ATALAYA · OSINT</p>
          <h1>Dossier de investigación</h1>
          <p className="dossier-sub">
            {semillaTxt}
            {' · '}
            {inf.modo === 'sembrado' ? 'datos de ejemplo' : 'investigación en vivo'}
            {' · '}
            {fechaCorta(inf.generadoEn)}
          </p>
          <p className="dossier-fuentes mono">
            {inf.totalEntidades} entidades · Fuentes: {inf.fuentes.join(', ') || 'ninguna'}
          </p>
          {inf.parcial || inf.avisos.length > 0 ? (
            <p className="dossier-aviso">
              Retrato posiblemente incompleto. {inf.avisos.join(' ')}
            </p>
          ) : null}
        </header>

        {inf.hallazgosClave.length > 0 && (
          <Seccion titulo="Hallazgos clave" num="01">
            <ul className="dossier-hallazgos">
              {inf.hallazgosClave.map((h, i) => (
                <li key={i} className={`dossier-hallazgo sev-${h.severidad}`}>
                  <span className="dossier-sev mono">{h.severidad}</span>
                  <span>
                    <strong>{h.titulo}.</strong> {h.detalle}
                  </span>
                </li>
              ))}
            </ul>
          </Seccion>
        )}

        {inf.identidades.length > 0 && (
          <Seccion titulo="Identidades" num="02">
            {inf.identidades.map((id, i) => (
              <div key={i} className="dossier-identidad">
                <h3>
                  {id.persona ?? 'Sin nombre'}{' '}
                  <span className="dossier-conf mono">confianza {id.confianza}</span>
                </h3>
                {id.ubicacion && <Dato k="Ubicación" v={id.ubicacion} />}
                {id.emails.length > 0 && <Dato k="Correos" v={id.emails.join(', ')} />}
                {id.usuarios.length > 0 && <Dato k="Usuarios" v={id.usuarios.join(', ')} />}
                {id.organizaciones.length > 0 && <Dato k="Organización" v={id.organizaciones.join(', ')} />}
                {id.cuentas.length > 0 && (
                  <div className="dossier-dato">
                    <span className="dossier-k mono">Cuentas</span>
                    <span className="dossier-v">
                      {id.cuentas.map((c, j) => (
                        <span key={j}>
                          <a href={c.url} target="_blank" rel="noreferrer">
                            {c.servicio}
                          </a>
                          {j < id.cuentas.length - 1 ? ' · ' : ''}
                        </span>
                      ))}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </Seccion>
        )}

        {(inf.exposicion.brechas.length > 0 || inf.exposicion.emailsExpuestos.length > 0) && (
          <Seccion titulo="Exposición y filtraciones" num="03">
            {inf.exposicion.emailsExpuestos.length > 0 && (
              <Dato k="Correos expuestos" v={inf.exposicion.emailsExpuestos.join(', ')} />
            )}
            {inf.exposicion.brechas.length > 0 && (
              <table className="dossier-tabla">
                <thead>
                  <tr>
                    <th>Filtración</th>
                    <th>Fecha</th>
                    <th>Registros</th>
                    <th>Datos expuestos</th>
                  </tr>
                </thead>
                <tbody>
                  {inf.exposicion.brechas.map((b, i) => (
                    <tr key={i}>
                      <td>{b.nombre}</td>
                      <td>{b.fecha ? fechaCorta(b.fecha) : '—'}</td>
                      <td>{b.registros ? Number(b.registros).toLocaleString('es') : '—'}</td>
                      <td>{b.datos ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Seccion>
        )}

        {inf.infraestructura.length > 0 && (
          <Seccion titulo="Infraestructura" num="04">
            {inf.infraestructura.map((b, i) => (
              <div key={i} className="dossier-infra">
                <h3>{b.dominio}</h3>
                {b.registrador && <Dato k="Registrador" v={b.registrador} />}
                {(b.registrado || b.expira) && (
                  <Dato k="Registro" v={`${b.registrado ? fechaCorta(b.registrado) : '—'} → ${b.expira ? fechaCorta(b.expira) : '—'}`} />
                )}
                {b.correo.length > 0 && <Dato k="Correo" v={b.correo.join(', ')} />}
                {b.dns.length > 0 && <Dato k="DNS" v={b.dns.join(', ')} />}
                {b.saas.length > 0 && <Dato k="SaaS" v={b.saas.join(', ')} />}
                {b.subdominios.length > 0 && <Dato k="Subdominios" v={b.subdominios.join(', ')} />}
                {b.ips.length > 0 && (
                  <table className="dossier-tabla">
                    <thead>
                      <tr>
                        <th>IP</th>
                        <th>País</th>
                        <th>Puertos</th>
                        <th>CVE</th>
                        <th>Alojamiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {b.ips.map((ip, j) => (
                        <tr key={j}>
                          <td className="mono">{ip.ip}</td>
                          <td>{ip.pais ?? '—'}</td>
                          <td className="mono">{ip.puertos ?? '—'}</td>
                          <td>{ip.cves ?? '—'}</td>
                          <td>{ip.hosting ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </Seccion>
        )}

        {inf.cuentasPorServicio.length > 0 && (
          <Seccion titulo="Huella digital (cuentas)" num="05">
            <ul className="dossier-lista">
              {inf.cuentasPorServicio.map((s, i) => (
                <li key={i}>
                  <strong>{s.servicio}</strong>:{' '}
                  {s.cuentas.map((u, j) => (
                    <span key={j}>
                      <a href={u} target="_blank" rel="noreferrer">
                        {u}
                      </a>
                      {j < s.cuentas.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </li>
              ))}
            </ul>
          </Seccion>
        )}

        {inf.organizaciones.length > 0 && (
          <Seccion titulo="Organizaciones y proveedores" num="06">
            <ul className="dossier-lista">
              {inf.organizaciones.map((o, i) => (
                <li key={i}>
                  <strong>{o.nombre}</strong> <span className="dossier-rol">· {o.rol}</span>
                </li>
              ))}
            </ul>
          </Seccion>
        )}

        {inf.conexiones.length > 0 && (
          <Seccion titulo="Conexiones" num="07">
            <ul className="dossier-lista">
              {inf.conexiones.map((c, i) => (
                <li key={i}>
                  <span className="dossier-contag mono">{c.tipo}</span> {c.texto}
                </li>
              ))}
            </ul>
          </Seccion>
        )}

        {inf.cronologia.length > 0 && (
          <Seccion titulo="Cronología" num="08">
            <ul className="dossier-crono">
              {inf.cronologia.map((e, i) => (
                <li key={i}>
                  <span className="dossier-fecha mono">{fechaCorta(e.fecha)}</span>
                  <span>{e.texto}</span>
                </li>
              ))}
            </ul>
          </Seccion>
        )}

        <footer className="dossier-pie">
          Generado por ATALAYA a partir de fuentes públicas y pasivas. Uso exclusivo para investigación
          autorizada. Los datos pueden contener falsos positivos; verifica antes de actuar.
        </footer>
      </article>
    </div>
  )
}

function Seccion({ titulo, num, children }: { titulo: string; num: string; children: ReactNode }) {
  return (
    <section className="dossier-sec">
      <h2>
        <span className="dossier-num mono">{num}</span>
        {titulo}
      </h2>
      {children}
    </section>
  )
}

function Dato({ k, v }: { k: string; v: string }) {
  return (
    <div className="dossier-dato">
      <span className="dossier-k mono">{k}</span>
      <span className="dossier-v">{v}</span>
    </div>
  )
}
