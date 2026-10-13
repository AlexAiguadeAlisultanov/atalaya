// Corner-brackets en L para los paneles glass. El contenedor padre debe ser
// position:relative. Puramente decorativo, oculto a lectores de pantalla.

export function Marco() {
  return (
    <>
      <span className="esq esq1" aria-hidden="true" />
      <span className="esq esq2" aria-hidden="true" />
      <span className="esq esq3" aria-hidden="true" />
      <span className="esq esq4" aria-hidden="true" />
    </>
  )
}
