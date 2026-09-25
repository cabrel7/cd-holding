import { describe, expect, it } from 'vitest'
// Fonction pure extraite de server/error.ts (aucune dépendance à H3Event ni aux imports
// auto-injectés par Nitro) : testable sans booter Nuxt, voir vitest.config.ts.
import { decideIsJsonRequest } from '../../server/error'

describe('decideIsJsonRequest', () => {
  it('should treat a request under /api/ as JSON even without an Accept header', () => {
    // Arrange
    const signals = { accept: undefined, userAgent: undefined, secFetchMode: undefined, path: '/api/auth/login' }

    // Act
    const result = decideIsJsonRequest(signals)

    // Assert
    expect(result).toBe(true)
  })

  it('should treat a curl request (default curl/x.y.z user-agent) as JSON', () => {
    // Arrange
    const signals = { accept: undefined, userAgent: 'curl/8.7.1', secFetchMode: undefined, path: '/some-page' }

    // Act
    const result = decideIsJsonRequest(signals)

    // Assert
    expect(result).toBe(true)
  })

  it('should treat an httpie request as JSON', () => {
    // Arrange
    const signals = { accept: undefined, userAgent: 'HTTPie/3.2.1', secFetchMode: undefined, path: '/some-page' }

    // Act
    const result = decideIsJsonRequest(signals)

    // Assert
    expect(result).toBe(true)
  })

  it('should treat a request with Accept: application/json as JSON', () => {
    // Arrange
    const signals = { accept: 'application/json', userAgent: 'Mozilla/5.0', secFetchMode: undefined, path: '/some-page' }

    // Act
    const result = decideIsJsonRequest(signals)

    // Assert
    expect(result).toBe(true)
  })

  it('should treat a CORS fetch (sec-fetch-mode: cors) as JSON', () => {
    // Arrange
    const signals = { accept: undefined, userAgent: 'Mozilla/5.0', secFetchMode: 'cors', path: '/some-page' }

    // Act
    const result = decideIsJsonRequest(signals)

    // Assert
    expect(result).toBe(true)
  })

  it('should treat a path ending in .json as JSON', () => {
    // Arrange
    const signals = { accept: undefined, userAgent: 'Mozilla/5.0', secFetchMode: undefined, path: '/sitemap.json' }

    // Act
    const result = decideIsJsonRequest(signals)

    // Assert
    expect(result).toBe(true)
  })

  it('should treat a plain browser page navigation as HTML, not JSON', () => {
    // Arrange
    const signals = {
      accept: 'text/html,application/xhtml+xml',
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0',
      secFetchMode: 'navigate',
      path: '/a-propos',
    }

    // Act
    const result = decideIsJsonRequest(signals)

    // Assert
    expect(result).toBe(false)
  })

  it('should prioritize an explicit Accept: text/html over an /api/ path', () => {
    // Arrange — cas limite : un navigateur qui suit un lien vers une route /api/ (rare, mais le
    // critère Accept: text/html doit gagner pour lui rendre une page, pas un JSON brut).
    const signals = { accept: 'text/html', userAgent: undefined, secFetchMode: undefined, path: '/api/files/some-key' }

    // Act
    const result = decideIsJsonRequest(signals)

    // Assert
    expect(result).toBe(false)
  })
})
