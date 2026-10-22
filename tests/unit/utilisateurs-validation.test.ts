import { describe, expect, it } from 'vitest'
// Alias `#shared/validation/utilisateurs` résolu par la config Vite de Nuxt (vitest.config.ts).
import {
  resetMotDePasseSchema,
  utilisateurCreateSchema,
  utilisateurUpdateSchema,
  utilisateursQuerySchema,
} from '#shared/validation/utilisateurs'

describe('utilisateursQuerySchema', () => {
  it('applique un défaut page=1 et accepte un objet vide', () => {
    const result = utilisateursQuerySchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.page).toBe(1)
  })

  it('rejette une clé inconnue (.strict())', () => {
    expect(utilisateursQuerySchema.safeParse({ site: 'entretien' }).success).toBe(false)
  })

  it("accepte les filtres role, actif ('true'/'false') et q trimé", () => {
    const result = utilisateursQuerySchema.safeParse({ role: 'ADMIN_FILIALE', actif: 'false', q: '  alice  ', page: 2 })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ role: 'ADMIN_FILIALE', actif: 'false', q: 'alice', page: 2 })
    }
  })

  it("rejette actif hors de l'enum 'true'/'false' et un rôle inconnu", () => {
    expect(utilisateursQuerySchema.safeParse({ actif: 'oui' }).success).toBe(false)
    expect(utilisateursQuerySchema.safeParse({ role: 'SUPERVA' }).success).toBe(false)
  })
})

describe('utilisateurCreateSchema', () => {
  const valide = { nom: 'Alice Tremblay', email: 'Alice@Example.TEST', role: 'EMPLOYE' as const, site: 'entretien' as const }

  it('normalise le email en minuscules', () => {
    const result = utilisateurCreateSchema.safeParse(valide)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe('alice@example.test')
  })

  it('rejette une clé inconnue (.strict())', () => {
    expect(utilisateurCreateSchema.safeParse({ ...valide, passwordHash: 'x' }).success).toBe(false)
  })

  it('rejette un rôle inconnu et un nom hors bornes', () => {
    expect(utilisateurCreateSchema.safeParse({ ...valide, role: 'ADMIN' }).success).toBe(false)
    expect(utilisateurCreateSchema.safeParse({ ...valide, nom: 'A' }).success).toBe(false)
  })

  it("échoue avec path ['site'] si le site manque pour un rôle de filiale", () => {
    const { site: _site, ...sansSite } = valide
    const result = utilisateurCreateSchema.safeParse(sansSite)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['site'])
      expect(result.error.issues[0]?.message).toBe('Une filiale est requise pour ce rôle.')
    }
  })

  it("échoue avec path ['site'] si un site est fourni pour SUPER_ADMIN", () => {
    const result = utilisateurCreateSchema.safeParse({ nom: 'Admin', email: 'a@b.co', role: 'SUPER_ADMIN', site: 'entretien' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['site'])
      expect(result.error.issues[0]?.message).toBe("Un super administrateur n'est rattaché à aucune filiale.")
    }
  })

  it("accepte SUPER_ADMIN sans site et ADMIN_FILIALE avec site", () => {
    expect(utilisateurCreateSchema.safeParse({ nom: 'Admin', email: 'a@b.co', role: 'SUPER_ADMIN' }).success).toBe(true)
    expect(
      utilisateurCreateSchema.safeParse({ nom: 'AF', email: 'af@b.co', role: 'ADMIN_FILIALE', site: 'transport' }).success,
    ).toBe(true)
  })

  it("rejette la holding comme site (enum FILIALE_SLUGS uniquement)", () => {
    expect(utilisateurCreateSchema.safeParse({ ...valide, site: 'holding' }).success).toBe(false)
  })
})

describe('utilisateurUpdateSchema', () => {
  it('rejette un objet vide (au moins un champ requis)', () => {
    const result = utilisateurUpdateSchema.safeParse({})
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.message).toBe('Au moins un champ à modifier est requis')
  })

  it('accepte un seul champ, y compris site seul (champ éditable, pas un scoping CMS)', () => {
    expect(utilisateurUpdateSchema.safeParse({ nom: 'Nouveau Nom' }).success).toBe(true)
    expect(utilisateurUpdateSchema.safeParse({ site: 'transport' }).success).toBe(true)
    expect(utilisateurUpdateSchema.safeParse({ actif: false }).success).toBe(true)
  })

  it("échoue avec path ['site'] pour role SUPER_ADMIN + site, même partiel", () => {
    const result = utilisateurUpdateSchema.safeParse({ role: 'SUPER_ADMIN', site: 'entretien' })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['site'])
  })

  it("accepte role: EMPLOYE sans site (le service tranche sur l'état fusionné)", () => {
    expect(utilisateurUpdateSchema.safeParse({ role: 'EMPLOYE' }).success).toBe(true)
  })

  it('rejette une clé inconnue (.strict())', () => {
    expect(utilisateurUpdateSchema.safeParse({ email: 'x@y.co' }).success).toBe(false)
  })
})

describe('resetMotDePasseSchema', () => {
  it('accepte un corps vide', () => {
    expect(resetMotDePasseSchema.safeParse({}).success).toBe(true)
  })

  it('rejette toute clé (le mot de passe est généré serveur)', () => {
    expect(resetMotDePasseSchema.safeParse({ nouveau: 'secret' }).success).toBe(false)
  })
})
