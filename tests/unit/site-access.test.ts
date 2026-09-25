import { describe, expect, it } from 'vitest'
import { decideReadScope, decideSitesListScope, decideWriteCompany } from '../../server/policies/site-access'
import { ROLES } from '../../shared/utils/roles'

const ENTRETIEN = 1
const CCDPAA = 2

describe('decideReadScope', () => {
  it('lets SUPER_ADMIN read everything when no site is requested', () => {
    expect(decideReadScope({ role: ROLES.SUPER_ADMIN, sessionCompanyId: null, requestedCompanyId: null })).toBe('all')
  })

  it('scopes SUPER_ADMIN to the requested company when one is given', () => {
    expect(decideReadScope({ role: ROLES.SUPER_ADMIN, sessionCompanyId: null, requestedCompanyId: ENTRETIEN })).toBe(
      'company',
    )
  })

  it('forces ADMIN_FILIALE to its own company when no site is requested', () => {
    expect(
      decideReadScope({ role: ROLES.ADMIN_FILIALE, sessionCompanyId: ENTRETIEN, requestedCompanyId: null }),
    ).toBe('company')
  })

  it('lets ADMIN_FILIALE read its own company explicitly', () => {
    expect(
      decideReadScope({ role: ROLES.ADMIN_FILIALE, sessionCompanyId: ENTRETIEN, requestedCompanyId: ENTRETIEN }),
    ).toBe('company')
  })

  it('forbids ADMIN_FILIALE from reading another company', () => {
    expect(
      decideReadScope({ role: ROLES.ADMIN_FILIALE, sessionCompanyId: ENTRETIEN, requestedCompanyId: CCDPAA }),
    ).toBe('forbidden')
  })

  it('forbids ADMIN_FILIALE with no company attached (data anomaly)', () => {
    expect(
      decideReadScope({ role: ROLES.ADMIN_FILIALE, sessionCompanyId: null, requestedCompanyId: null }),
    ).toBe('forbidden')
  })

  it('forbids EMPLOYE regardless of the requested company', () => {
    expect(decideReadScope({ role: ROLES.EMPLOYE, sessionCompanyId: ENTRETIEN, requestedCompanyId: null })).toBe(
      'forbidden',
    )
  })
})

describe('decideSitesListScope (GET /api/admin/sites)', () => {
  it('lets SUPER_ADMIN list every company', () => {
    expect(decideSitesListScope(ROLES.SUPER_ADMIN, null)).toBe('all')
  })

  it('scopes ADMIN_FILIALE to its own company only', () => {
    expect(decideSitesListScope(ROLES.ADMIN_FILIALE, ENTRETIEN)).toBe('company')
  })

  it('forbids ADMIN_FILIALE with no company attached (data anomaly)', () => {
    expect(decideSitesListScope(ROLES.ADMIN_FILIALE, null)).toBe('forbidden')
  })

  it('forbids EMPLOYE regardless of session company', () => {
    expect(decideSitesListScope(ROLES.EMPLOYE, ENTRETIEN)).toBe('forbidden')
  })
})

describe('decideWriteCompany', () => {
  it('requires an explicit site for SUPER_ADMIN', () => {
    expect(decideWriteCompany({ role: ROLES.SUPER_ADMIN, sessionCompanyId: null, requestedCompanyId: null })).toBe(
      'missing',
    )
  })

  it('lets SUPER_ADMIN write to any explicitly named company', () => {
    expect(
      decideWriteCompany({ role: ROLES.SUPER_ADMIN, sessionCompanyId: null, requestedCompanyId: CCDPAA }),
    ).toBe('company')
  })

  it('forces ADMIN_FILIALE to its own company when no site is given', () => {
    expect(
      decideWriteCompany({ role: ROLES.ADMIN_FILIALE, sessionCompanyId: ENTRETIEN, requestedCompanyId: null }),
    ).toBe('company')
  })

  it('forbids ADMIN_FILIALE from writing to another company', () => {
    expect(
      decideWriteCompany({ role: ROLES.ADMIN_FILIALE, sessionCompanyId: ENTRETIEN, requestedCompanyId: CCDPAA }),
    ).toBe('forbidden')
  })

  it('forbids ADMIN_FILIALE with no company attached (data anomaly)', () => {
    expect(
      decideWriteCompany({ role: ROLES.ADMIN_FILIALE, sessionCompanyId: null, requestedCompanyId: null }),
    ).toBe('forbidden')
  })

  it('forbids EMPLOYE from writing anywhere', () => {
    expect(
      decideWriteCompany({ role: ROLES.EMPLOYE, sessionCompanyId: ENTRETIEN, requestedCompanyId: ENTRETIEN }),
    ).toBe('forbidden')
  })
})
