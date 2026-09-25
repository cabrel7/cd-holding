// Augmentation de `PageMeta` pour les rôles requis par page admin (spec phase 2 §4.5/§4.6).
// `definePageMeta({ roles: [...] })` sur chaque page /admin/** protégée par un rôle précis —
// `app/middleware/admin.ts` lit ce champ pour rediriger un rôle non autorisé.
import type { AppRole } from '#shared/utils/roles'

declare module '#app' {
  interface PageMeta {
    /** Rôles autorisés sur cette page. Absent = toute session valide suffit (voir middleware). */
    roles?: readonly AppRole[]
  }
}

export {}
