import { ADMIN_NAV } from '@/config/admin-nav'
import { ADMIN_HOME_PATH, ADMIN_LOGIN_PATH } from '#shared/utils/roles'
import { adminHref } from '#shared/utils/site-links'

// Cible de redirection post-connexion, limitée aux pages internes de l'admin (anti
// open-redirect, spec lot 8, D8) : forme préfixée `/admin/...` OU forme nue connue des
// pages admin — jamais `//hôte`, jamais de backslash, jamais l'écran de connexion (boucle).
// La cible est renvoyée dans la forme servie sur l'hôte courant : `hoteAdmin` = strip actif
// (admin.chauvierdelor.com), faux = dev/e2e chemin (comportement strictement inchangé).

// Racines nues servies par l'admin : dérivées d'ADMIN_NAV (source unique) — une entrée de
// nav = une racine acceptée. Le tableau de bord (racine `/`) n'accepte que sa forme exacte,
// sinon tout chemin nu serait « sous la racine / ».
const RACINES_NUES: readonly string[] = ADMIN_NAV.map((item) => adminHref(item.to, true))

function racineConnue(chemin: string): boolean {
  return RACINES_NUES.some((racine) =>
    racine === '/' ? chemin === '/' : chemin === racine || chemin.startsWith(`${racine}/`),
  )
}

export function safeAdminRedirect(target: unknown, hoteAdmin = false): string {
  const repli = adminHref(ADMIN_HOME_PATH, hoteAdmin)
  if (typeof target !== 'string') return repli
  if (target.includes('\\') || target.startsWith('//')) return repli

  const indexSuite = target.search(/[?#]/)
  const chemin = indexSuite === -1 ? target : target.slice(0, indexSuite)
  const suite = indexSuite === -1 ? '' : target.slice(indexSuite)

  const prefixe = chemin === '/admin' || chemin.startsWith('/admin/')
  const nue = hoteAdmin && !prefixe && chemin.startsWith('/') && racineConnue(chemin)
  if (!prefixe && !nue) return repli

  // Boucle : ni la page de connexion préfixée, ni sa forme nue, quelle que soit l'hôte.
  if (chemin === ADMIN_LOGIN_PATH || chemin === adminHref(ADMIN_LOGIN_PATH, true)) return repli

  return `${adminHref(chemin, hoteAdmin)}${suite}`
}
