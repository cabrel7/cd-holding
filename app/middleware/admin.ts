// Protège l'UI /admin/** (SPA). NE protège PAS les données : chaque route /api/admin/**
// refait requireRole + scoping filiale côté serveur (voir server/utils/auth.ts).
// Rôles par page (spec phase 2 §4.5) : `definePageMeta({ roles: [...] })` (type augmenté dans
// app/types/page-meta.d.ts) ; un rôle non autorisé (ex. EMPLOYE sur /admin/contenu/**) est
// renvoyé au tableau de bord plutôt qu'à une page blanche ou une erreur 403 côté client.
// Sur l'écran de connexion : un utilisateur déjà connecté est renvoyé vers sa cible sûre.
// Formes servies homogènes (spec lot 8, D8) : nu sur admin.chauvierdelor.com, préfixée
// ailleurs. Les comparaisons normalisent les DEUX côtés via toAdminPath — après un
// chargement complet le path serveur est préfixé (réécriture amont), après une navigation
// SPA il est nu sur l'hôte admin.
export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, user, fetch: fetchSession } = useUserSession()
  if (!loggedIn.value) {
    await fetchSession()
  }

  const cheminCourant = toAdminPath(to.path)
  const cheminConnexion = toAdminPath(ADMIN_LOGIN_PATH)
  const cheminAccueil = toAdminPath(ADMIN_HOME_PATH)

  if (cheminCourant === cheminConnexion) {
    return loggedIn.value ? navigateTo(safeAdminRedirect(to.query.redirect, hoteEstAdmin())) : undefined
  }

  if (!loggedIn.value) {
    return navigateTo({ path: cheminConnexion, query: { redirect: to.fullPath } })
  }

  // Un employé n'a qu'une seule page : son planning. Toute visite du tableau de bord
  // (y compris via le renvoi des pages interdites ci-dessous) y est redirigée.
  if (cheminCourant === cheminAccueil && user.value?.role === ROLES.EMPLOYE) {
    return navigateTo(toAdminPath('/admin/mon-planning'))
  }

  const allowedRoles = to.meta.roles
  if (allowedRoles && (!user.value || !allowedRoles.includes(user.value.role))) {
    return navigateTo(cheminAccueil)
  }
})
