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
})
