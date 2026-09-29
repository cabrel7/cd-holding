// Protège l'UI /admin/** (SPA). NE protège PAS les données : chaque route /api/admin/**
// refait requireRole + scoping filiale côté serveur (voir server/utils/auth.ts).
// Rôles par page (spec phase 2 §4.5) : `definePageMeta({ roles: [...] })` (type augmenté dans
// app/types/page-meta.d.ts) ; un rôle non autorisé (ex. EMPLOYE sur /admin/contenu/**) est
// renvoyé au tableau de bord plutôt qu'à une page blanche ou une erreur 403 côté client.
// Sur l'écran de connexion : un utilisateur déjà connecté est renvoyé vers sa cible sûre.
export default defineNuxtRouteMiddleware(async (to) => {
  const { loggedIn, user, fetch: fetchSession } = useUserSession()
  if (!loggedIn.value) {
    await fetchSession()
  }

  if (to.path === ADMIN_LOGIN_PATH) {
    return loggedIn.value ? navigateTo(safeAdminRedirect(to.query.redirect)) : undefined
  }

  if (!loggedIn.value) {
    return navigateTo({ path: ADMIN_LOGIN_PATH, query: { redirect: to.fullPath } })
  }

  const allowedRoles = to.meta.roles
  if (allowedRoles && (!user.value || !allowedRoles.includes(user.value.role))) {
    return navigateTo(ADMIN_HOME_PATH)
  }
})
