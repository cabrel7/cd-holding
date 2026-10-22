import { describe, expect, it } from 'vitest'
import { safeAdminRedirect } from '../../app/utils/safe-redirect'

describe('safeAdminRedirect', () => {
  it.each([
    ['/admin', '/admin'],
    ['/admin/messages', '/admin/messages'],
    ['/admin/messages?statut=NOUVEAU&page=2', '/admin/messages?statut=NOUVEAU&page=2'],
    ['/admin/contenu#haut', '/admin/contenu#haut'],
  ])('conserve la cible interne %s', (cible, attendu) => {
    expect(safeAdminRedirect(cible)).toBe(attendu)
  })

  it.each([
    '//evil.com',
    '//evil.com/admin',
    'https://evil.com',
    '/\\evil.com',
    '/admin\\..\\evil',
    '/adminevil',
    '/admin.evil.com',
    '/public',
    '',
    undefined,
    null,
    ['/admin/messages'],
    42,
  ])('ignore la cible non sûre %j', (cible) => {
    expect(safeAdminRedirect(cible)).toBe('/admin')
  })

  it("n'y renvoie jamais vers l'écran de connexion (boucle)", () => {
    expect(safeAdminRedirect('/admin/login')).toBe('/admin')
    expect(safeAdminRedirect('/admin/login?redirect=/admin')).toBe('/admin')
  })

  // Forme nue (D8) : acceptée uniquement sur l'hôte admin, normalisée vers la forme servie.
  it.each([
    ['/admin', '/'],
    ['/admin/messages', '/messages'],
    ['/admin/messages?statut=NOUVEAU&page=2', '/messages?statut=NOUVEAU&page=2'],
    ['/admin/contenu#haut', '/contenu#haut'],
    ['/admin?tri=asc', '/?tri=asc'],
    ['/messages', '/messages'],
    ['/comptable/dossiers/123', '/comptable/dossiers/123'],
    ['/mon-planning', '/mon-planning'],
    ['/', '/'],
  ])('normalise %s vers la forme nue servie sur l’hôte admin', (cible, attendu) => {
    expect(safeAdminRedirect(cible, true)).toBe(attendu)
  })

  it.each([
    '//evil.com',
    'https://evil.com',
    '/\\evil.com',
    '/admin\\..\\evil',
    '/public',
    '/confidentialite',
    '/login',
    '/admin/login?redirect=/messages',
    '',
    undefined,
    null,
    42,
  ])('ignore la cible non sûre %j sur l’hôte admin', (cible) => {
    expect(safeAdminRedirect(cible, true)).toBe('/')
  })

  it("n'y renvoie jamais vers l'écran de connexion nu (boucle)", () => {
    expect(safeAdminRedirect('/login', true)).toBe('/')
    expect(safeAdminRedirect('/admin/login', true)).toBe('/')
  })

  it('n’accepte pas les cibles nues en mode chemin (dev/e2e inchangés)', () => {
    expect(safeAdminRedirect('/messages')).toBe('/admin')
    expect(safeAdminRedirect('/')).toBe('/admin')
  })
})
