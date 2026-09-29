import { toast } from 'vue-sonner'
import { ADMIN_COMPTEURS_KEY, ADMIN_SITES_KEY } from '@/composables/useAdminShell'

const LOGOUT_ERROR_MESSAGE = 'Déconnexion impossible. Réessayez.'

export const useAuthStore = defineStore('auth', () => {
  const { user, loggedIn, clear, fetch } = useUserSession()

  // Les données du shell dépendent du compte : ne jamais les laisser fuiter vers le suivant.
  function clearShellData(): void {
    clearNuxtData([ADMIN_SITES_KEY, ADMIN_COMPTEURS_KEY])
  }

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
    await navigateTo(ADMIN_LOGIN_PATH)
    return true
  }

  return { user, loggedIn, login, logout }
})
