import { adminHref } from '#shared/utils/site-links'

// Forme servie des chemins admin (spec lot 8, D8) : nu sur admin.chauvierdelor.com (et
// admin.localhost en e2e), préfixée `/admin` partout ailleurs — dev inclus, inchangé.

/** L'hôte courant sert-il l'admin à chemins nus ? */
export function hoteEstAdmin(): boolean {
  return useSiteHost().value.slug === 'admin'
}

/** Traduit un chemin admin préfixé vers la forme servie sur l'hôte courant. */
export function toAdminPath(path: string): string {
  return adminHref(path, hoteEstAdmin())
}
