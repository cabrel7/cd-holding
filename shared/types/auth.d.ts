import type { AppRole } from '../utils/roles'

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
    nom: string
    role: AppRole
    companyId: string | null
  }

  interface UserSession {
    loggedInAt: number
  }
}

export {}
