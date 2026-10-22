import { describe, expect, it } from 'vitest'
import {
  genererMotDePasseTemporaire,
  resoudreRattachement,
  toCompteDto,
  verifierAutoModification,
  verifierDernierSuperAdmin,
  type CompteRow,
} from '../../server/lib/admin/comptes'

const CLES_DTO = ['actif', 'company', 'email', 'nom', 'role', 'uuid']

describe('toCompteDto', () => {
  const base: CompteRow = {
    uuid: '0b3f1a2c-0000-4000-8000-000000000020',
    nom: 'Marc-André Roy',
    email: 'marc@example.test',
    role: 'ADMIN_FILIALE',
    actif: true,
    company: { uuid: '0b3f1a2c-0000-4000-8000-000000000002', nom: 'CD Transport', slug: 'transport' },
  }

  it('n’expose que les 6 champs du compte, avec la filiale rattachée', () => {
    const dto = toCompteDto(base)
    expect(Object.keys(dto).sort()).toEqual(CLES_DTO)
    expect(dto.uuid).toBe(base.uuid)
    expect(dto.nom).toBe('Marc-André Roy')
    expect(dto.email).toBe('marc@example.test')
    expect(dto.role).toBe('ADMIN_FILIALE')
    expect(dto.actif).toBe(true)
    expect(dto.company).toEqual({ uuid: base.company?.uuid, nom: 'CD Transport', slug: 'transport' })
  })

  it('garde company null pour un SUPER_ADMIN (accès groupe entier, D7)', () => {
    const dto = toCompteDto({ ...base, role: 'SUPER_ADMIN', company: null })
    expect(Object.keys(dto).sort()).toEqual(CLES_DTO)
    expect(dto.company).toBeNull()
  })

  it('ne fait pas transiter id, companyId, passwordHash ni passwordChangedAt d’une row sale', () => {
    const sale = {
      ...base,
      id: 42,
      companyId: 7,
      passwordHash: 'scrypt$fake$hash',
      passwordChangedAt: new Date('2026-10-12T10:00:00.000Z'),
      createdAt: new Date('2026-01-15T10:00:00.000Z'),
    } as unknown as CompteRow

    const dto = toCompteDto(sale)
    expect(Object.keys(dto).sort()).toEqual(CLES_DTO)
    expect(dto).not.toHaveProperty('id')
    expect(dto).not.toHaveProperty('companyId')
    expect(dto).not.toHaveProperty('passwordHash')
    expect(dto).not.toHaveProperty('passwordChangedAt')
    expect(dto).not.toHaveProperty('createdAt')
    expect(JSON.stringify(dto)).not.toContain('scrypt$fake$hash')
  })
})

describe('verifierAutoModification', () => {
  it('cible = session → compte-propre (D3, y compris le reset)', () => {
    expect(verifierAutoModification('uuid-a', 'uuid-a')).toBe('compte-propre')
  })

  it('cible = un tiers → aucune objection', () => {
    expect(verifierAutoModification('uuid-cible', 'uuid-session')).toBeNull()
  })
})

describe('verifierDernierSuperAdmin', () => {
  const actifSA = { roleActuel: 'SUPER_ADMIN', actifActuel: true } as const
  const devenir = (role: 'SUPER_ADMIN' | 'EMPLOYE', actif: boolean) => ({ roleResultant: role, actifResultant: actif })

  it('désactivation du dernier SA actif → refus (D4)', () => {
    expect(verifierDernierSuperAdmin({ ...actifSA, ...devenir('SUPER_ADMIN', false) }, 0)).toBe('dernier-super-admin')
  })

  it('rétrogradation du dernier SA actif → refus (l’actif SA passe à zéro)', () => {
    expect(verifierDernierSuperAdmin({ ...actifSA, ...devenir('EMPLOYE', true) }, 0)).toBe('dernier-super-admin')
  })

  it('un second SA actif existe → opération autorisée', () => {
    expect(verifierDernierSuperAdmin({ ...actifSA, ...devenir('SUPER_ADMIN', false) }, 1)).toBeNull()
  })

  it('désactivation d’un tiers hors SUPER_ADMIN → jamais concernée', () => {
    expect(
      verifierDernierSuperAdmin(
        { roleActuel: 'EMPLOYE', actifActuel: true, roleResultant: 'EMPLOYE', actifResultant: false },
        0,
      ),
    ).toBeNull()
  })

  it('cible déjà inactif ou opération sans effet sur le statut SA → null', () => {
    expect(verifierDernierSuperAdmin({ ...actifSA, actifActuel: false, ...devenir('SUPER_ADMIN', false) }, 0)).toBeNull()
    expect(verifierDernierSuperAdmin({ ...actifSA, ...devenir('SUPER_ADMIN', true) }, 0)).toBeNull()
    expect(verifierDernierSuperAdmin({ ...actifSA, ...devenir('SUPER_ADMIN', true) }, 3)).toBeNull()
  })
})

describe('resoudreRattachement', () => {
  it('SUPER_ADMIN + site fourni → site-inattendu (D7)', () => {
    expect(resoudreRattachement('SUPER_ADMIN', { companyId: 2 }, null)).toEqual({
      ok: false,
      code: 'site-inattendu',
    })
  })

  it('SUPER_ADMIN sans site → companyId null', () => {
    expect(resoudreRattachement('SUPER_ADMIN', undefined, null)).toEqual({ ok: true, companyId: null })
  })

  it('rôle de filiale sans site ni rattachement actuel → site-requis', () => {
    expect(resoudreRattachement('EMPLOYE', undefined, null)).toEqual({ ok: false, code: 'site-requis' })
  })

  it('rôle de filiale avec site → companyId du site', () => {
    expect(resoudreRattachement('ADMIN_FILIALE', { companyId: 4 }, 2)).toEqual({ ok: true, companyId: 4 })
  })

  it('rôle de filiale sans site mais rattachement actuel → conservé (fusion PATCH)', () => {
    expect(resoudreRattachement('EMPLOYE', undefined, 2)).toEqual({ ok: true, companyId: 2 })
  })
})

describe('genererMotDePasseTemporaire', () => {
  const ALPHABET = /^[A-Za-z2-9]+$/
  const SANS_AMBIGUITE = /[0O1lI]/

  it('fait 16 caractères sur l’alphabet sans ambiguïté', () => {
    const mot = genererMotDePasseTemporaire()
    expect(mot).toHaveLength(16)
    expect(mot).toMatch(ALPHABET)
    expect(mot).not.toMatch(SANS_AMBIGUITE)
  })

  it('deux tirages successifs diffèrent (espace de 57^16)', () => {
    expect(genererMotDePasseTemporaire()).not.toBe(genererMotDePasseTemporaire())
  })
})
