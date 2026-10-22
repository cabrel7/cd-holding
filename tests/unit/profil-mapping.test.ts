import { describe, expect, it } from 'vitest'
import { toProfilDto, type ProfilMapRow } from '../../server/services/admin/profil'

const COMPANY = { uuid: '0b3f1a2c-0000-4000-8000-000000000001', nom: 'CD Entretien' }
const CLES_DTO = ['company', 'email', 'nom', 'role', 'uuid']

describe('toProfilDto', () => {
  const base: ProfilMapRow = {
    uuid: '0b3f1a2c-0000-4000-8000-000000000010',
    nom: 'Jeanne Tremblay',
    email: 'jeanne@example.test',
    role: 'EMPLOYE',
    company: COMPANY,
  }

  it('n’expose que les 5 champs du profil, avec la filiale rattachée', () => {
    const dto = toProfilDto(base)
    expect(Object.keys(dto).sort()).toEqual(CLES_DTO)
    expect(dto.uuid).toBe(base.uuid)
    expect(dto.nom).toBe('Jeanne Tremblay')
    expect(dto.email).toBe('jeanne@example.test')
    expect(dto.role).toBe('EMPLOYE')
    expect(dto.company).toEqual({ uuid: COMPANY.uuid, nom: COMPANY.nom })
  })

  it('garde company null pour un compte sans filiale (SUPER_ADMIN)', () => {
    const dto = toProfilDto({ ...base, role: 'SUPER_ADMIN', company: null })
    expect(Object.keys(dto).sort()).toEqual(CLES_DTO)
    expect(dto.role).toBe('SUPER_ADMIN')
    expect(dto.company).toBeNull()
  })

  it('ne fait pas transiter id, passwordHash ni companyId d’une row sale', () => {
    const sale = {
      ...base,
      id: 42,
      passwordHash: 'scrypt$fake$hash',
      companyId: 7,
      actif: true,
      createdAt: new Date('2026-01-15T10:00:00.000Z'),
    } as unknown as ProfilMapRow

    const dto = toProfilDto(sale)
    expect(Object.keys(dto).sort()).toEqual(CLES_DTO)
    expect(dto).not.toHaveProperty('id')
    expect(dto).not.toHaveProperty('passwordHash')
    expect(dto).not.toHaveProperty('companyId')
    expect(dto).not.toHaveProperty('actif')
    expect(dto).not.toHaveProperty('createdAt')
    expect(JSON.stringify(dto)).not.toContain('scrypt$fake$hash')
  })
})
