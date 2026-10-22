// Isolation des routes par hôte (spec lot 8, D4/D8) — la table de routage est unique au build,
// l'hôte n'y est pas connu : chaque direction fait son ménage à l'exécution, en universel.
//
// - Hôte admin : les records publics (holding, `[filiale]`, offres, restaurant, confidentialite)
//   sont retirés pour que `/` nu serve le dashboard et jamais l'accueil holding, et que les
//   chemins publics soient des 404.
// - Tout autre hôte : les clones nus ADMIN (`bare-admin*`) sont retirés — sinon leurs chemins
//   statiques (`/comptable`, `/placement`, `/utilisateurs`, `/messages`…) écraseraient les
//   routes publiques (vue-router : statique bat param `[filiale]`, et une page admin se
//   rendrait sur un site public). Les clones nus PUBLICS (`bare-filiale-*`, `bare-ccdpaa-*`…)
//   restent : leur `validate` gate le mode sous-domaine.

/**
 * Préfixe des routes clonées par `modules/bare-routes.ts` — contrat en miroir (impossible à
 * partager : `modules/` vit dans le projet node, `app/` dans le projet app).
 */
const PREFIXE_ROUTE_NUE = 'bare-'

/** Préfixe de nom des clones nus des pages admin (`bare-admin`, `bare-admin-comptable`…). */
const PREFIXE_NUE_ADMIN = 'bare-admin'

export default defineNuxtPlugin(() => {
  const host = useSiteHost()
  // Environnement sans routage (tests composants purs, @nuxt/test-utils) : ne rien faire —
  // un `useRouter()` absent ne doit jamais casser l'initialisation de l'app.
  const router = useRouter()
  if (!router) return

  if (host.value.slug === 'admin') {
    // Copie nécessaire : `getRoutes()` renvoie le tableau vivant des matchers, retirer pendant
    // l'itération ferait sauter des éléments.
    for (const route of [...router.getRoutes()]) {
      const name = route.name
      // Sans nom : `admin/contenu.vue` (parent d'une route index) — son chemin est sous `/admin`.
      if (typeof name !== 'string') continue
      // Routes nues (admin et publiques) : les nues publiques tombent en 404 via leur `validate`,
      // les nues admin doivent rester servies.
      if (name.startsWith(PREFIXE_ROUTE_NUE)) continue
      // Toutes les pages d'admin non nues vivent sous `/admin` → conservées (chemin legacy).
      if (route.path.startsWith('/admin')) continue
      // Reste : les records publics (holding, `[filiale]`, offres, restaurant, confidentialite).
      router.removeRoute(name)
    }
  } else {
    for (const route of [...router.getRoutes()]) {
      const name = route.name
      if (typeof name !== 'string') continue
      // Clone nu d'une page admin (`bare-admin`, `bare-admin-comptable`…) — `bare-admin` seul
      // est le clone du tableau de bord ; les nus publics (bare-filiale-*, bare-ccdpaa-*,
      // bare-placement-offres-*) ne matchent jamais ce préfixe.
      if (name === PREFIXE_NUE_ADMIN || name.startsWith(`${PREFIXE_NUE_ADMIN}-`)) {
        router.removeRoute(name)
      }
    }
  }

  // Aucune re-navigation ici de propos délibéré : `nuxt:router` capture le chemin initial avant
  // ce plugin et Nuxt l'applique ensuite dans son hook `app:created` avec `name: undefined`
  // (`nuxt/dist/pages/runtime/plugins/router.js`) — vue-router repart donc du `path` contre la
  // table mise à jour (`/` nu résout `bare-admin` sur l'hôte admin, la holding ailleurs).
})
