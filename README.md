# ATALAYA

Plataforma de evaluación de exposición y OSINT. Enseña lo que una organización
expone a internet y tira del hilo de un dato hasta conectar todo lo que cuelga,
siempre con fuentes **públicas y pasivas**: nunca toca el objetivo.

Dos herramientas en una:

- **Exposición (EASM + CTEM).** Escribe un dominio y ATALAYA reconstruye su
  superficie de ataque (subdominios, IPs, servicios, CVE) y la colapsa en una
  única nota de exposición **priorizada por riesgo real** (EPSS + catálogo KEV de
  CISA + criticidad del activo), no por CVSS a secas.
- **OSINT.** Parte de un email, un usuario, un dominio o una IP y pivota por
  fuentes públicas hasta dibujar un grafo de entidades: nombre, cuentas,
  filtraciones, proveedores e infraestructura. Genera un **dossier exportable a
  PDF** que junta, conecta y organiza todo lo recopilado.

## Cómo funciona por dentro

- **Motor en TypeScript puro y determinista** (`src/engine/`): una sola fuente de
  verdad para el cálculo de exposición, el grafo y la correlación del dossier.
  Mismos datos, mismo resultado. Cubierto por tests.
- **Servidor proxy** (`server/`, Express + TypeScript): el navegador nunca llama a
  las fuentes externas (CORS, límites, fragilidad); lo hace el servidor, que
  cachea en SQLite (`node:sqlite`, sin dependencias) y degrada con elegancia si
  una fuente cae.
- **Interfaz** (React 19 + Vite): landing cinematográfica dirigida por scroll,
  grafo interactivo, cockpit de exposición y dossier imprimible.

### Fuentes (todas gratuitas y sin clave)

crt.sh y HackerTarget (subdominios), DNS-over-HTTPS (Cloudflare), Shodan
InternetDB (puertos y servicios), Shodan CVEDB (CVSS + EPSS + KEV), CISA KEV
(plazos), RDAP (whois), Gravatar, XposedOrNot (filtraciones) y la API de GitHub.
Opcionalmente, una clave de NVD afina el CVSS (`ATALAYA_NVD_KEY`).

## Desarrollo

```bash
npm install
npm run dev:all   # front en :5173 y API en :3099 (Vite hace proxy de /api)
npm test          # tests del motor (Vitest)
npm run typecheck # front + servidor
npm run build     # compila el front a dist/
npm start         # sirve dist/ + la API (lo que usa Render)
```

Copia `.env.example` a `.env` para ajustar el puerto, la ruta de la base o la
clave opcional de NVD. Nada es obligatorio: sin configurar nada, funciona.

## Despliegue

`render.yaml` incluye el Blueprint para Render (Node, `npm run build` + `npm
start`, healthcheck en `/api/salud`).

## Ética y uso

ATALAYA hace solo **reconocimiento pasivo** sobre fuentes públicas. Analizar
datos de terceros exige autorización; la interfaz pide consentimiento explícito
antes de cualquier consulta en vivo y limita el uso diario. Pensado para
investigación autorizada y defensa.
