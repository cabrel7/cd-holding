import { describe, expect, it } from 'vitest'
import { cheminSansQuery, formaterErreurPourLog } from '../../server/lib/log-erreur'

const REQ = { statusCode: 500, method: 'POST', path: '/api/public/placement/candidatures?email=jean@exemple.ca' }

describe('formaterErreurPourLog', () => {
  it('never logs the message of a Prisma-like error (PII in arguments), only name and code', () => {
    const erreur = Object.assign(new Error('Invalid prisma.candidature.create() invocation: nom: "Jean Tremblay", email: "jean@exemple.ca"'), {
      name: 'PrismaClientKnownRequestError',
      code: 'P2002',
    })
    const contexte = formaterErreurPourLog(erreur, REQ)
    expect(contexte).toEqual({
      statusCode: 500,
      method: 'POST',
      path: '/api/public/placement/candidatures',
      erreur: 'PrismaClientKnownRequestError',
      code: 'P2002',
    })
    expect(JSON.stringify(contexte)).not.toContain('Jean')
    expect(JSON.stringify(contexte)).not.toContain('jean@')
  })

  it('uses the root cause of an H3-style wrapper, and drops the wrapper message', () => {
    const cause = Object.assign(new Error('secret jean@exemple.ca'), { name: 'PrismaClientValidationError' })
    const h3 = Object.assign(new Error('secret jean@exemple.ca'), { statusMessage: 'secret jean@exemple.ca', cause })
    const contexte = formaterErreurPourLog(h3, REQ)
    expect(contexte.erreur).toBe('PrismaClientValidationError')
    expect(contexte.message).toBeUndefined()
  })

  it('keeps the generic message of a deliberate createError without cause', () => {
    const erreur = Object.assign(new Error('Erreur serveur'), { statusMessage: 'Erreur serveur' })
    expect(formaterErreurPourLog(erreur, REQ).message).toBe('Erreur serveur')
  })

  it('handles non-object throwables', () => {
    expect(formaterErreurPourLog('boom jean@exemple.ca', REQ).erreur).toBe('ErreurInconnue')
  })

  it('survives a cause cycle', () => {
    const a: { cause?: unknown; name: string } = { name: 'A' }
    a.cause = a
    expect(formaterErreurPourLog(a, REQ).erreur).toBe('A')
  })
})

describe('cheminSansQuery', () => {
  it('strips the query string', () => {
    expect(cheminSansQuery('/a/b?x=1')).toBe('/a/b')
    expect(cheminSansQuery(undefined)).toBeUndefined()
  })
})
