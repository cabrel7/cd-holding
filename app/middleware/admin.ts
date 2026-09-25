// Protège l'UI /admin/** (SPA). NE protège PAS les données : chaque route /api/admin/**
// refait requireRole + scoping filiale côté serveur (voir server/utils/auth.ts).
export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path === ADMIN_LOGIN_PATH) return

  const { loggedIn, fetch: fetchSession } = useUserSession()
  if (!loggedIn.value) {
    await fetchSession()
  }
  if (!loggedIn.value) {
    return navigateTo({ path: ADMIN_LOGIN_PATH, query: { redirect: to.fullPath } })
  }
})
