export const useAuthStore = defineStore('auth', () => {
  const { user, loggedIn, clear, fetch } = useUserSession()

  async function login(email: string, password: string): Promise<void> {
    await $fetch('/api/auth/login', { method: 'POST', body: { email, password } })
    await fetch()
  }

  async function logout(): Promise<void> {
    await $fetch('/api/auth/logout', { method: 'POST' })
    await clear()
    await navigateTo(ADMIN_LOGIN_PATH)
  }

  return { user, loggedIn, login, logout }
})
