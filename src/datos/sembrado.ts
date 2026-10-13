// Datos de demostración PRE-SEMBRADOS.
//
// Por qué existen: la demo del portfolio tiene que abrir al instante y verse
// perfecta aunque Render esté dormido o una fuente externa esté caída ese día.
// Estos dominios son de ejemplo y usan IPs de los rangos reservados a
// documentación (RFC 5737: 203.0.113.0/24 y 198.51.100.0/24), que no existen en
// internet. Los valores de EPSS/KEV son una INSTANTÁNEA de ejemplo, no un feed en
// vivo; el servidor marca la fecha al servirlos.
//
// Cuando el usuario analiza su propio dominio (con consentimiento), NO se usa esto:
// se va por el camino "vivo" del servidor contra las fuentes pasivas reales.

import type { Cve, Servicio, SuperficieAtaque } from '../engine/tipos'

export const INSTANTANEA = '2026-10-01'

export interface FichaDominio {
  dominio: string
  nombre: string
  sector: string
  descripcion: string
}

interface EntradaSub {
  sub: string
  ip: string
  certDias?: number
  servicios: Servicio[]
}

function svc(
  puerto: number,
  nombre: string,
  producto: string | undefined,
  version: string | undefined,
  cves: Cve[],
): Servicio {
  return {
    puerto,
    protocolo: 'tcp',
    nombre,
    producto,
    version,
    cpe: producto ? `cpe:2.3:a:${producto.toLowerCase().replace(/\s+/g, '_')}:${version ?? '*'}` : undefined,
    cves,
  }
}

function construir(dominio: string, entradas: EntradaSub[]): SuperficieAtaque {
  const fuentes = ['crtsh', 'dns', 'internetdb', 'nvd', 'epss', 'kev']
  return {
    dominio,
    generadoEn: `${INSTANTANEA}T08:00:00.000Z`,
    modo: 'sembrado',
    parcial: false,
    fuentes,
    subdominios: entradas.map((e) => ({
      nombre: `${e.sub}.${dominio}`,
      ips: [e.ip],
      origen: ['crtsh', 'dns'],
    })),
    activos: entradas.map((e) => ({
      ip: e.ip,
      tipo: 'ipv4',
      hosts: [`${e.sub}.${dominio}`],
      servicios: e.servicios,
      certificadoCaducaEnDias: e.certDias,
      pais: 'ES',
      organizacion: dominio,
    })),
  }
}

// ---------- CVE de ejemplo (instantánea) ----------
const C = {
  pan: { id: 'CVE-2024-3400', cvss: 10.0, epss: 0.94, kev: true, kevPlazo: '2024-04-19', descripcion: 'Inyección de comandos en GlobalProtect (PAN-OS).' },
  ivanti: { id: 'CVE-2024-21887', cvss: 9.1, epss: 0.97, kev: true, kevPlazo: '2024-01-22', descripcion: 'Inyección de comandos en Ivanti Connect Secure.' },
  outlook: { id: 'CVE-2023-23397', cvss: 9.8, epss: 0.89, kev: true, kevPlazo: '2023-03-30', descripcion: 'Elevación de privilegios en Microsoft Outlook.' },
  log4shell: { id: 'CVE-2021-44228', cvss: 10.0, epss: 0.975, kev: true, kevPlazo: '2021-12-24', descripcion: 'Ejecución remota de código en Apache Log4j (Log4Shell).' },
  teamcity: { id: 'CVE-2024-27198', cvss: 9.8, epss: 0.71, kev: false, descripcion: 'Bypass de autenticación en JetBrains TeamCity.' },
  f5: { id: 'CVE-2022-1388', cvss: 9.8, epss: 0.62, kev: false, descripcion: 'Bypass de autenticación en F5 BIG-IP iControl REST.' },
  vsftpd: { id: 'CVE-2011-2523', cvss: 9.8, epss: 0.33, kev: false, descripcion: 'Puerta trasera en vsftpd 2.3.4.' },
  heartbleed: { id: 'CVE-2014-0160', cvss: 7.5, epss: 0.94, kev: false, descripcion: 'Fuga de memoria en OpenSSL (Heartbleed).' },
  bluekeep: { id: 'CVE-2019-0708', cvss: 9.8, epss: 0.9, kev: true, kevPlazo: '2022-05-03', descripcion: 'RCE en Escritorio remoto de Windows (BlueKeep).' },
  proxylogon: { id: 'CVE-2021-26855', cvss: 9.8, epss: 0.94, kev: true, kevPlazo: '2021-03-18', descripcion: 'SSRF en Microsoft Exchange (ProxyLogon).' },
  moveit: { id: 'CVE-2023-34362', cvss: 9.8, epss: 0.9, kev: true, kevPlazo: '2023-06-23', descripcion: 'Inyección SQL en Progress MOVEit Transfer.' },
  fortinet: { id: 'CVE-2018-13379', cvss: 9.8, epss: 0.9, kev: true, kevPlazo: '2021-11-17', descripcion: 'Lectura de ficheros en FortiOS SSL VPN.' },
  confluence: { id: 'CVE-2022-26134', cvss: 9.8, epss: 0.95, kev: true, kevPlazo: '2022-06-06', descripcion: 'OGNL injection en Atlassian Confluence.' },
  // Severidad media/alta sin KEV: sirven para los dominios demo menos expuestos.
  sweet32: { id: 'CVE-2016-2183', cvss: 7.5, epss: 0.05, kev: false, descripcion: 'SWEET32: cifrado de 64 bits (3DES) todavía aceptado en TLS.' },
  credssp: { id: 'CVE-2018-0886', cvss: 7.4, epss: 0.08, kev: false, descripcion: 'Ejecución remota en CredSSP (RDP) por retransmisión.' },
  opensshEnum: { id: 'CVE-2016-6210', cvss: 5.9, epss: 0.03, kev: false, descripcion: 'Enumeración de usuarios por tiempos en OpenSSH.' },
  nginxMp4: { id: 'CVE-2022-41741', cvss: 7.0, epss: 0.05, kev: false, descripcion: 'Corrupción de memoria en el módulo mp4 de nginx.' },
} satisfies Record<string, Cve>

// ---------- banco-ejemplo.es (alta exposición) ----------
const banco = construir('banco-ejemplo.es', [
  { sub: 'www', ip: '203.0.113.10', certDias: -3, servicios: [svc(443, 'https', 'nginx', '1.18.0', [C.log4shell]), svc(80, 'http', 'nginx', '1.18.0', [])] },
  { sub: 'vpn', ip: '198.51.100.7', servicios: [svc(443, 'https', 'Ivanti Connect Secure', '22.5', [C.ivanti]), svc(500, 'ike', undefined, undefined, [])] },
  { sub: 'correo', ip: '203.0.113.24', servicios: [svc(443, 'https', 'Microsoft Exchange', '2019', [C.outlook, C.proxylogon]), svc(25, 'smtp', 'Exchange', '2019', [])] },
  { sub: 'api', ip: '203.0.113.51', servicios: [svc(443, 'https', 'JetBrains TeamCity', '2023.11', [C.teamcity])] },
  { sub: 'portal', ip: '203.0.113.52', certDias: 12, servicios: [svc(443, 'https', 'F5 BIG-IP', '16.1', [C.f5]), svc(8080, 'http-alt', undefined, undefined, [])] },
  { sub: 'dev', ip: '198.51.100.33', servicios: [svc(22, 'ssh', 'OpenSSH', '7.2', []), svc(3000, 'http', 'Node', '18', [C.log4shell])] },
  { sub: 'ftp', ip: '198.51.100.41', servicios: [svc(21, 'ftp', 'vsftpd', '2.3.4', [C.vsftpd])] },
  { sub: 'cdn', ip: '203.0.113.88', servicios: [svc(443, 'https', 'cloudfront', undefined, [])] },
])

// ---------- clinica-ejemplo.es (exposición alta, sin KEV críticas) ----------
const clinica = construir('clinica-ejemplo.es', [
  { sub: 'www', ip: '203.0.113.120', servicios: [svc(443, 'https', 'Apache httpd', '2.4.49', [C.heartbleed])] },
  { sub: 'citas', ip: '203.0.113.121', certDias: 5, servicios: [svc(443, 'https', 'nginx', '1.20', [])] },
  { sub: 'correo', ip: '203.0.113.122', servicios: [svc(443, 'https', 'Microsoft Exchange', '2016', [C.sweet32]), svc(993, 'imaps', undefined, undefined, [])] },
  { sub: 'historias', ip: '198.51.100.90', servicios: [svc(3389, 'rdp', 'Windows', 'Server 2016', [C.credssp])] },
  { sub: 'ftp', ip: '198.51.100.91', servicios: [svc(21, 'ftp', 'ProFTPD', '1.3.3', [])] },
])

// ---------- logistica-ejemplo.es (exposición media) ----------
const logistica = construir('logistica-ejemplo.es', [
  { sub: 'www', ip: '203.0.113.200', servicios: [svc(443, 'https', 'nginx', '1.24', [C.nginxMp4])] },
  { sub: 'seguimiento', ip: '203.0.113.201', servicios: [svc(22, 'ssh', 'OpenSSH', '9.6', [])] },
  { sub: 'transferencias', ip: '203.0.113.202', servicios: [svc(443, 'https', 'nginx', '1.18', [C.sweet32])] },
  { sub: 'vpn', ip: '198.51.100.150', certDias: 20, servicios: [svc(443, 'https', 'FortiOS', '7.2', [])] },
])

export const DOMINIOS_DEMO: FichaDominio[] = [
  { dominio: 'banco-ejemplo.es', nombre: 'Banca Ejemplo', sector: 'Servicios financieros', descripcion: 'Entidad financiera con VPN, correo y portal de cliente expuestos.' },
  { dominio: 'clinica-ejemplo.es', nombre: 'Clínica Ejemplo', sector: 'Sanidad', descripcion: 'Centro médico con portal de citas e historias clínicas.' },
  { dominio: 'logistica-ejemplo.es', nombre: 'Logística Ejemplo', sector: 'Transporte y logística', descripcion: 'Operador logístico con seguimiento y transferencias de ficheros.' },
]

const MAPA: Record<string, SuperficieAtaque> = {
  'banco-ejemplo.es': banco,
  'clinica-ejemplo.es': clinica,
  'logistica-ejemplo.es': logistica,
}

export function esDominioDemo(dominio: string): boolean {
  return dominio.toLowerCase() in MAPA
}

/** Devuelve una copia profunda de la superficie sembrada para no mutar el original. */
export function superficieSembrada(dominio: string): SuperficieAtaque | undefined {
  const base = MAPA[dominio.toLowerCase()]
  return base ? structuredClone(base) : undefined
}
