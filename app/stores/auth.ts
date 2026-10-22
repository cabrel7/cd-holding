import { toast } from 'vue-sonner'
import { clearAdminCache } from '@/utils/admin-unauthorized'

const LOGOUT_ERROR_MESSAGE = 'Déconnexion impossible. Réessayez.'

export const useAuthStore = defineStore('auth', () => {
  const { user, loggedIn, clear, fetch } = useUserSession()

  // Toutes les données admin (`admin-*` : sites, compteurs, listes, dashboard, ressources CMS)
  // dépendent du compte : ne jamais les laisser fuiter vers le suivant.
  const clearShellData = clearAdminCache

  async function login(email: string, password: string): Promise<void> {
    await $fetch('/api/auth/login', { method: 'POST', body: { email, password } })
    clearShellData()
    await fetch()
  }

  /** `true` si la session est fermée ; sinon toast d'erreur et `false` (la session reste active). */
  async function logout(): Promise<boolean> {
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
      await clear()
    } catch {
      toast.error(LOGOUT_ERROR_MESSAGE)
      return false
    }
    clearShellData()
    await navigateTo(toAdminPath(ADMIN_LOGIN_PATH))
    return true
  }

  return { user, loggedIn, login, logout }
})
