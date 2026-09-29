import { describe, expect, it } from 'vitest'
import { isNavItemActive, navLabel, visibleNavItems, ADMIN_NAV } from '../../app/config/admin-nav'
import { ROLES } from '../../shared/utils/roles'

const AUCUN_MODULE = new Set<never>()

describe('admin-nav', () => {
  it('EMPLOYE ne voit que le tableau de bord', () => {
    expect(visibleNavItems(ROLES.EMPLOYE, AUCUN_MODULE).map((i) => i.to)).toEqual(['/admin'])
  })

  it.each([ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE])('%s voit les 4 entrées converties', (role) => {
    expect(visibleNavItems(role, AUCUN_MODULE).map((i) => i.to)).toEqual([
      '/admin',
      '/admin/messages',
      '/admin/clients',
      '/admin/contenu',
    ])
  })

  it('libellé du contenu selon le rôle', () => {
    const contenu = ADMIN_NAV.find((i) => i.to === '/admin/contenu')!
    expect(navLabel(contenu, ROLES.SUPER_ADMIN)).toBe('Contenu des sites')
    expect(navLabel(contenu, ROLES.ADMIN_FILIALE)).toBe('Contenu de mon site')
  })

  it("le tableau de bord n'est actif que sur le chemin exact", () => {
    const [accueil, messages] = ADMIN_NAV
    expect(isNavItemActive(accueil!, '/admin')).toBe(true)
    expect(isNavItemActive(accueil!, '/admin/messages')).toBe(false)
    expect(isNavItemActive(messages!, '/admin/messages')).toBe(true)
    expect(isNavItemActive(messages!, '/admin/messagesx')).toBe(false)
  })
})
