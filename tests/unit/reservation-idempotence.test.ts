import { describe, expect, it, vi } from 'vitest'
import { ecrireIdempotent, estConflitSerialisation, estViolationUnique } from '../../server/lib/reservation'

// Closures simulées (fonction pure, spec lot 5 §7) : zéro Prisma/mail/storage à mocker.
const conflitPrisma = Object.assign(new Error('conflict'), { code: 'P2034' })
const conflitPostgres = Object.assign(new Error('serialization failure'), { meta: { code: '40001' } })
const violationUnique = Object.assign(new Error('unique constraint failed'), { code: 'P2002' })

describe('estViolationUnique', () => {
  it('ne reconnaît que le code P2002', () => {
    expect(estViolationUnique(violationUnique)).toBe(true)
    expect(estViolationUnique(conflitPrisma)).toBe(false)
    expect(estViolationUnique(conflitPostgres)).toBe(false)
    expect(estViolationUnique(new Error('boom'))).toBe(false)
    expect(estViolationUnique('P2002')).toBe(false)
    expect(estViolationUnique(null)).toBe(false)
  })

  it('reste disjoint de estConflitSerialisation', () => {
    expect(estConflitSerialisation(violationUnique)).toBe(false)
    expect(estConflitSerialisation(conflitPrisma)).toBe(true)
    expect(estConflitSerialisation(conflitPostgres)).toBe(true)
  })
})

describe('ecrireIdempotent', () => {
  it('répond "existante" immédiatement sur P2002, sans relecture ni second essai', async () => {
    const tenter = vi.fn().mockRejectedValue(violationUnique)
    const relireExiste = vi.fn().mockResolvedValue(true)
    expect(await ecrireIdempotent(tenter, relireExiste)).toBe('existante')
    expect(tenter).toHaveBeenCalledTimes(1)
    expect(relireExiste).not.toHaveBeenCalled()
  })

  it('relit après P2034 puis répond "existante" si la ligne identique est présente', async () => {
    const tenter = vi.fn().mockRejectedValue(conflitPrisma)
    const relireExiste = vi.fn().mockResolvedValue(true)
    expect(await ecrireIdempotent(tenter, relireExiste)).toBe('existante')
    expect(tenter).toHaveBeenCalledTimes(1)
    expect(relireExiste).toHaveBeenCalledTimes(1)
  })

  it('relit aussi après un 40001 Postgres (meta.code) puis répond "existante"', async () => {
    const tenter = vi.fn().mockRejectedValue(conflitPostgres)
    expect(await ecrireIdempotent(tenter, async () => true)).toBe('existante')
    expect(tenter).toHaveBeenCalledTimes(1)
  })

  it('retente une seule fois après P2034 sans ligne identique', async () => {
    const tenter = vi.fn().mockRejectedValueOnce(conflitPrisma).mockResolvedValueOnce('creee')
    expect(await ecrireIdempotent(tenter, async () => false)).toBe('creee')
    expect(tenter).toHaveBeenCalledTimes(2)
  })

  it('remonte un second conflit de sérialisation', async () => {
    const tenter = vi.fn().mockRejectedValue(conflitPrisma)
    await expect(ecrireIdempotent(tenter, async () => false)).rejects.toBe(conflitPrisma)
    expect(tenter).toHaveBeenCalledTimes(2)
  })

  it('remonte toute autre erreur sans relire', async () => {
    const autre = new Error('boom')
    const relireExiste = vi.fn().mockResolvedValue(true)
    await expect(ecrireIdempotent(vi.fn().mockRejectedValue(autre), relireExiste)).rejects.toBe(autre)
    expect(relireExiste).not.toHaveBeenCalled()
  })

  it('ne passe jamais par la relecture sur P2002 même quand elle échouerait', async () => {
    const relireExiste = vi.fn().mockRejectedValue(new Error('ne doit pas être appelée'))
    expect(await ecrireIdempotent(vi.fn().mockRejectedValue(violationUnique), relireExiste)).toBe('existante')
    expect(relireExiste).not.toHaveBeenCalled()
  })
})
