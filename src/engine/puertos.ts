// Conocimiento estático del motor: qué puertos son sensibles y por qué, y qué
// nombres de host sugieren un activo crítico. Son heurísticas documentadas, no
// magia: están aquí, en un solo sitio, para que la prioridad sea explicable.

export interface PuertoSensible {
  puerto: number
  motivo: string
}

/** Puertos que, expuestos a internet, elevan el riesgo por sí solos. */
export const PUERTOS_SENSIBLES: Record<number, string> = {
  21: 'FTP sin cifrar expuesto a internet',
  22: 'SSH accesible desde cualquier parte',
  23: 'Telnet: credenciales en claro',
  25: 'SMTP expuesto (relay / exposición de correo)',
  135: 'RPC de Windows expuesto',
  139: 'NetBIOS expuesto',
  445: 'SMB expuesto a internet (ransomware clásico)',
  1433: 'Microsoft SQL Server accesible',
  3306: 'MySQL accesible desde internet',
  3389: 'Escritorio remoto (RDP) expuesto',
  5432: 'PostgreSQL accesible desde internet',
  5900: 'VNC expuesto',
  6379: 'Redis sin autenticar por defecto',
  9200: 'Elasticsearch expuesto',
  27017: 'MongoDB accesible desde internet',
}

export function esPuertoSensible(puerto: number): boolean {
  return puerto in PUERTOS_SENSIBLES
}

export function motivoPuerto(puerto: number): string | undefined {
  return PUERTOS_SENSIBLES[puerto]
}

/** Palabras en el nombre de host que indican un activo de alto valor. */
const CRITICIDAD_HOST: Array<{ claves: string[]; peso: number; etiqueta: string }> = [
  { claves: ['vpn', 'gateway', 'gw', 'acceso'], peso: 1, etiqueta: 'punto de acceso remoto' },
  { claves: ['admin', 'panel', 'manage', 'gestion', 'consola'], peso: 1, etiqueta: 'panel de administración' },
  { claves: ['correo', 'mail', 'smtp', 'webmail', 'exchange', 'owa'], peso: 0.8, etiqueta: 'correo' },
  { claves: ['api', 'auth', 'sso', 'login', 'id', 'identidad'], peso: 0.8, etiqueta: 'autenticación / API' },
  { claves: ['pago', 'pay', 'checkout', 'banca', 'wallet'], peso: 0.9, etiqueta: 'pagos' },
  { claves: ['dev', 'test', 'pre', 'staging', 'uat', 'lab'], peso: 0.6, etiqueta: 'entorno de pruebas expuesto' },
  { claves: ['db', 'sql', 'base', 'datos', 'backup', 'copia'], peso: 0.9, etiqueta: 'datos / copias' },
]

/**
 * Criticidad de un host entre 0 y 1 por lo que dice su nombre.
 * Devuelve también la etiqueta humana del motivo dominante.
 */
export function criticidadHost(nombre: string): { peso: number; etiqueta?: string } {
  const n = nombre.toLowerCase()
  let mejor = { peso: 0, etiqueta: undefined as string | undefined }
  for (const regla of CRITICIDAD_HOST) {
    if (regla.claves.some((c) => n.includes(c)) && regla.peso > mejor.peso) {
      mejor = { peso: regla.peso, etiqueta: regla.etiqueta }
    }
  }
  return mejor
}
