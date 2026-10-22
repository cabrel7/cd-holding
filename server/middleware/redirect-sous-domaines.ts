import { cibleRedirection } from '#shared/utils/site-links'

// Repli testable des redirections 301 canoniques (spec lot 8, D5) : Nginx fait le gros du
// travail en prod, ce middleware couvre l'exposition directe de l'app et rend le 301
// vérifiable sans Nginx. En dev/e2e aucun hôte n'est connu → jamais déclenché.
//
// AUCUNE réécriture d'event.path ici : le spike T0.0 (h3 fige `_reqPath` avant la boucle
// des layers) montre qu'une telle réécriture serait silencieusement perdue pour le router —
// seul Nginx peut réécrire (upstream). Ce middleware ne répond que 301.
export default defineEventHandler((event) => {
  // GET et HEAD : un checkeur de liens en HEAD doit voir le 301 comme un navigateur (revue m2).
  if (event.method !== 'GET' && event.method !== 'HEAD') return

  const host = getHeader(event, 'host') ?? ''
  if (!host) return

  // Topologie Nginx (D5) : la réécriture bare → préfixé de l'edge envoie /services à
  // l'app sous /entretien/services. Si on stripait ce préfixe ici, on renverrait le
  // client sur /services, que Nginx réécrirait à nouveau → boucle 301. L'edge marque
  // ses réécritures internes (X-Edge-Rewrite) : le 301 canonique sur URL préfixée
  // reste son rôle (strip au edge avant proxy), celui du middleware est le repli en
  // exposition directe — là où aucun marqueur n'existe.
  if (getHeader(event, 'x-edge-rewrite')) return

  const cible = cibleRedirection(host, event.path, getRequestURL(event).origin)
  if (cible) sendRedirect(event, cible, 301)
})
