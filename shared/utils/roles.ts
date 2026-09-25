// Source unique des rôles côté app ET serveur (auto-importé depuis shared/utils).
// Doit rester aligné sur l'enum `Role` de prisma/schema.prisma.
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN_FILIALE: 'ADMIN_FILIALE',
  EMPLOYE: 'EMPLOYE',
} as const

export type AppRole = (typeof ROLES)[keyof typeof ROLES]

export const ADMIN_LOGIN_PATH = '/admin/login'
export const ADMIN_HOME_PATH = '/admin'
