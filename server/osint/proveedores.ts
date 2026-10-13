// Traduce huellas DNS a proveedores reconocibles. Un host MX/NS o una línea TXT
// (SPF, verificaciones) delata qué servicios usa una organización: correo en la
// nube, CDN, SaaS. Son heurísticas documentadas, en un solo sitio.

const POR_HOST: Array<[RegExp, string]> = [
  [/outlook|office365|microsoft/i, 'Microsoft 365'],
  [/google|googlemail|googledomains|l\.google/i, 'Google'],
  [/cloudflare/i, 'Cloudflare'],
  [/nsone|\bns1\b/i, 'NS1'],
  [/awsdns|amazonaws|amazon/i, 'Amazon AWS'],
  [/azure/i, 'Microsoft Azure'],
  [/proton/i, 'Proton'],
  [/zoho/i, 'Zoho'],
  [/godaddy|domaincontrol/i, 'GoDaddy'],
  [/dnsmadeeasy/i, 'DNS Made Easy'],
  [/akamai/i, 'Akamai'],
  [/fastly/i, 'Fastly'],
  [/ovh/i, 'OVH'],
  [/dnsimple/i, 'DNSimple'],
  [/registrar-servers|namecheap/i, 'Namecheap'],
]

export function proveedorDeHost(host: string): string | null {
  for (const [re, nombre] of POR_HOST) if (re.test(host)) return nombre
  return null
}

const POR_TXT: Array<[RegExp, string]> = [
  [/spf\.protection\.outlook|include:.*outlook/i, 'Microsoft 365'],
  [/_spf\.google|include:.*google/i, 'Google Workspace'],
  [/amazonses/i, 'Amazon SES'],
  [/sendgrid/i, 'SendGrid'],
  [/mailgun/i, 'Mailgun'],
  [/servers\.mcsv\.net|mandrillapp/i, 'Mailchimp'],
  [/zoho/i, 'Zoho'],
  [/\bMS=/i, 'Microsoft (verificación)'],
  [/google-site-verification/i, 'Google (verificación)'],
  [/facebook-domain-verification/i, 'Meta'],
  [/atlassian-domain-verification/i, 'Atlassian'],
  [/docusign/i, 'DocuSign'],
  [/stripe-verification/i, 'Stripe'],
  [/adobe-(idp-site-verification|sign)/i, 'Adobe'],
  [/pardot/i, 'Salesforce Pardot'],
  [/dropbox-domain-verification/i, 'Dropbox'],
]

/** Lista única de SaaS/proveedores detectados en los registros TXT. */
export function saasDeTxt(txt: string[]): string[] {
  const set = new Set<string>()
  for (const linea of txt) {
    for (const [re, nombre] of POR_TXT) if (re.test(linea)) set.add(nombre)
  }
  return [...set]
}
