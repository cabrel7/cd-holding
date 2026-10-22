import { defineNuxtModule } from 'nuxt/kit'
import type { NuxtPage } from '@nuxt/schema'

// Routes nues (spec lot 8, D4) : sur un sous-domaine filiale/admin, le même chemin est servi
// sans préfixe de site (`entretien…/services`, `admin…/utilisateurs`). Le doublement se fait au
// build — l'hôte n'est pas connu ici ; le gate se joue dans `definePageMeta.validate` de chaque
// page. La spec écrit `pages:extended` : le hook réel de Nuxt 4 est `pages:extend`.

/**
 * Préfixe des noms de routes clonés — contrat en miroir avec
 * `PREFIXE_ROUTE_NUE` dans `app/plugins/admin-routes.ts` (les deux fichiers ne peuvent pas
 * partager une constante : `modules/` vit dans le projet node, `app/` dans le projet app).
 */
const PREFIXE_ROUTE_NUE = 'bare-'

const PREFIXE_ADMIN = '/admin'

/**
 * Pages publiques servies sans préfixe : `[fin de fichier relatif à app/pages, chemin nu]`.
 * La racine (`/`, `/a-propos`, `/contact`, `/realisations`) n'est volontairement pas dupliquée :
 * ce sont les pages holding elles-mêmes qui deviennent des dispatchers (spec D4).
 */
const CIBLES_PUBLIQUES: ReadonlyArray<readonly [finFichier: string, cheminNu: string]> = [
  ['pages/[filiale]/services.vue', '/services'],
  ['pages/[filiale]/mentions-legales.vue', '/mentions-legales'],
  ['pages/ccdpaa/restaurant.vue', '/restaurant'],
  ['pages/placement/offres/index.vue', '/offres'],
  ['pages/placement/offres/[uuid].vue', '/offres/[uuid]'],
  ['pages/placement/offres/candidature-spontanee.vue', '/offres/candidature-spontanee'],
]

function trouverPage(pages: readonly NuxtPage[], finFichier: string): NuxtPage | undefined {
  for (const page of pages) {
    if (page.file?.endsWith(finFichier)) return page
    const trouve = page.children ? trouverPage(page.children, finFichier) : undefined
    if (trouve) return trouve
  }
  return undefined
}

/**
 * Clone d'une page avec son chemin nu. `cheminNu` ne s'applique qu'à la page racine du clone :
 * les enfants gardent leur chemin relatif (vue-router les reconstruit sous le nouveau parent).
 * Les noms sont préfixés pour rester uniques — vue-router 5 remplace silencieusement un record
 * qui porte déjà le même nom.
 */
function dupliquer(page: NuxtPage, cheminNu?: string): NuxtPage {
  const clone: NuxtPage = { ...page }
  if (cheminNu !== undefined) clone.path = cheminNu
  if (clone.name !== undefined) {
    clone.name = `${PREFIXE_ROUTE_NUE}${clone.name}`
  } else {
    // Parent sans nom (`admin/contenu.vue`, parent d'une route index) : nommer le clone quand
    // même, à partir de son chemin ORIGINAL — sinon il est indétroitable par `removeRoute(name)`
    // dans le plugin et le shell admin fuirait sur les hôtes publics (`/contenu`) — revue lot 8
    // M4. Suffixe `-parent` : le slug nu du chemin est déjà pris par le clone de l'enfant
    // `contenu/index.vue` (`bare-admin-contenu`) — un doublon de nom ferait lever vue-router à
    // l'initialisation (constaté : NUXT_E1005 en environnement de test).
    clone.name = `${PREFIXE_ROUTE_NUE}${page.path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '')}-parent`
  }
  if (clone.children !== undefined) clone.children = clone.children.map((enfant) => dupliquer(enfant))
  return clone
}

function estSousAdmin(chemin: string): boolean {
  return chemin === PREFIXE_ADMIN || chemin.startsWith(`${PREFIXE_ADMIN}/`)
}

export default defineNuxtModule({
  meta: { name: 'bare-routes' },
  setup(_options, nuxt) {
    nuxt.hook('pages:extend', (pages) => {
      const clones: NuxtPage[] = []

      // Arborescence admin : `/admin/utilisateurs` → `/utilisateurs` (spec D8), arborescence et
      // meta conservées (`contenu.vue` reste parent de `contenu/*`).
      for (const page of pages) {
        if (estSousAdmin(page.path)) clones.push(dupliquer(page, page.path.slice(PREFIXE_ADMIN.length) || '/'))
      }

      for (const [finFichier, cheminNu] of CIBLES_PUBLIQUES) {
        const source = trouverPage(pages, finFichier)
        if (source) clones.push(dupliquer(source, cheminNu))
      }

      // Ajout en fin de tableau : à score égal, vue-router préserve l'ordre d'insertion (premier
      // inséré l'emporte) — la racine holding `/` reste donc prioritaire sur le dashboard nu, ce
      // qui n'a d'importance que sur les hôtes non admin (le plugin admin retire `index`).
      pages.push(...clones)
    })
  },
})
