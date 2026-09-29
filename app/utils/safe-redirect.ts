import { ADMIN_HOME_PATH, ADMIN_LOGIN_PATH } from '#shared/utils/roles'

/**
 * Cible de redirection post-connexion, limitée aux chemins internes de l'admin (anti
 * open-redirect) : `/admin` ou `/admin/...` (éventuellement `?query`/`#hash`), jamais `//hôte`,
 * jamais de backslash, jamais l'écran de connexion lui-même (boucle).
 */
export function safeAdminRedirect(target: unknown): string {
  if (typeof target !== 'string') return ADMIN_HOME_PATH
  const interne = /^\/admin(?:[/?#]|$)/.test(target) && !target.includes('\\') && !target.startsWith('//')
  if (!interne) return ADMIN_HOME_PATH
  const chemin = target.split(/[?#]/)[0]
  if (chemin === ADMIN_LOGIN_PATH) return ADMIN_HOME_PATH
  return target
}
