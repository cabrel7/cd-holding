import type { AppRole } from '../utils/roles'

declare module '#auth-utils' {
  // Envoyé au client (cookie de session scellé) : uniquement des identifiants externes.
  // Jamais d'id/companyId numérique interne ici — voir SecureSessionData ci-dessous.
  interface User {
    uuid: string
    nom: string
    role: AppRole
    companyUuid: string | null
  }

  interface UserSession {
    loggedInAt: number
  }

  // Jamais envoyé au client — nuxt-auth-utils la garde côté serveur uniquement.
  // C'est ici (et uniquement ici) que vivent les id/companyId numériques internes.
  interface SecureSessionData {
    userId: number
    companyId: number | null
  }
}

export {}
