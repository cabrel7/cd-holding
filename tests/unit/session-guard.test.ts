import { describe, expect, it } from 'vitest'
import { evaluerSession, type CompteSession, type SessionConnue } from '../../server/lib/session-guard'

const SESSION: SessionConnue = { role: 'EMPLOYE', companyId: 3 }
const COMPTE_BASE: CompteSession = {
  actif: true,
  role: 'EMPLOYE',
  companyId: 3,
  passwordChangedAt: null,
}
const T0 = 1_760_000_000_000

describe('evaluerSession', () => {
  it('compte absent → compte-introuvable', () => {
    expect(evaluerSession(T0, SESSION, null)).toEqual({ ok: false, echec: 'compte-introuvable' })
  })

  it('compte inactif → compte-inactif', () => {
    expect(evaluerSession(T0, SESSION, { ...COMPTE_BASE, actif: false })).toEqual({
      ok: false,
      echec: 'compte-inactif',
    })
  })

  it('rôle de la session différent du compte → role-modifie', () => {
    expect(evaluerSession(T0, SESSION, { ...COMPTE_BASE, role: 'ADMIN_FILIALE' })).toEqual({
      ok: false,
      echec: 'role-modifie',
    })
  })

  it('companyId de session différent (valeur ↔ null) → filiale-modifiee', () => {
    expect(evaluerSession(T0, { role: 'EMPLOYE', companyId: null }, { ...COMPTE_BASE, companyId: 3 })).toEqual({
      ok: false,
      echec: 'filiale-modifiee',
    })
    expect(evaluerSession(T0, SESSION, { ...COMPTE_BASE, companyId: null })).toEqual({
      ok: false,
      echec: 'filiale-modifiee',
    })
  })

  it('passwordChangedAt strictement postérieur à loggedInAt → mot-de-passe-change', () => {
    expect(evaluerSession(T0, SESSION, { ...COMPTE_BASE, passwordChangedAt: new Date(T0 + 1) })).toEqual({
      ok: false,
      echec: 'mot-de-passe-change',
    })
  })

  it('égalité au même millième → valable (D10, session courante après bump)', () => {
    expect(evaluerSession(T0, SESSION, { ...COMPTE_BASE, passwordChangedAt: new Date(T0) })).toEqual({ ok: true })
  })

  it('passwordChangedAt antérieur (ancienne session) → valable', () => {
    expect(evaluerSession(T0, SESSION, { ...COMPTE_BASE, passwordChangedAt: new Date(T0 - 1) })).toEqual({ ok: true })
  })

  it('passwordChangedAt null → valable (grandfathering : aucun re-login forcé au déploiement)', () => {
    expect(evaluerSession(T0, SESSION, { ...COMPTE_BASE, passwordChangedAt: null })).toEqual({ ok: true })
  })

  it('loggedInAt absent + colonne renseignée → mot-de-passe-change (jamais de session sans date au-dessus d’un mdp changé)', () => {
    expect(evaluerSession(undefined, SESSION, { ...COMPTE_BASE, passwordChangedAt: new Date(T0) })).toEqual({
      ok: false,
      echec: 'mot-de-passe-change',
    })
  })

  it('loggedInAt absent + colonne null → valable', () => {
    expect(evaluerSession(undefined, SESSION, COMPTE_BASE)).toEqual({ ok: true })
  })

  it('cas nominal → ok', () => {
    expect(evaluerSession(T0, SESSION, COMPTE_BASE)).toEqual({ ok: true })
    expect(evaluerSession(T0, { role: 'SUPER_ADMIN', companyId: null }, {
      actif: true,
      role: 'SUPER_ADMIN',
      companyId: null,
      passwordChangedAt: new Date(T0 - 60_000),
    })).toEqual({ ok: true })
  })

  it('l’ordre des contrôles est déterministe : inactif prime sur rôle modifié et mdp changé', () => {
    expect(
      evaluerSession(T0, SESSION, {
        actif: false,
        role: 'SUPER_ADMIN',
        companyId: null,
        passwordChangedAt: new Date(T0 + 1),
      }),
    ).toEqual({ ok: false, echec: 'compte-inactif' })
  })
})
