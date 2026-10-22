// /[filiale]/mentions-legales (spec docs/specs/lot7-mentions-legales.md) : la page n'existe que
// pour la filiale boissons (catalogue MENTIONS_LEGALES portée ['boissons']) — 404 pour les
// autres filiales. La mention alcool (COMMUN:mentionAlcool) est rendue au pied de page, avec le
// lien « Mentions légales » ; les autres filiales ne doivent montrer ni l'une ni l'autre.
// Assertions volontairement indépendantes du viewport (le spec tourne sur desktop ET mobile).
import { test, expect } from '@playwright/test'

test.describe('mentions-legales', () => {
  test('boissons : page servie avec les textes RACJ et le lien du pied de page', async ({ page }) => {
    const reponse = await page.goto('/boissons/mentions-legales')
    expect(reponse?.status()).toBe(200)

    await expect(page.getByRole('heading', { level: 1, name: 'Mentions légales' })).toBeVisible()
    // Corps scopé : « Régie des alcools » / « mineures » existent aussi ailleurs (mention du
    // pied de page) — sans <article>, l'assertion passerait même si le corps était vide.
    const corps = page.getByRole('article')
    await expect(
      corps.getByText('Régie des alcools, des courses et des jeux', { exact: false }),
    ).toBeVisible()
    await expect(
      corps.getByText('Aucun contenu de ce site ne s’adresse aux personnes mineures', { exact: false }),
    ).toBeVisible()

    const footer = page.getByRole('contentinfo')
    const lienFooter = footer.getByRole('link', { name: 'Mentions légales' })
    await expect(lienFooter).toBeVisible()
    await expect(lienFooter).toHaveAttribute('href', '/boissons/mentions-legales')
    await expect(footer.getByText('Buvez avec modération', { exact: false }).first()).toBeVisible()
  })

  test('filiale sans mentions (entretien) : 404', async ({ page }) => {
    const reponse = await page.goto('/entretien/mentions-legales')
    expect(reponse?.status()).toBe(404)
  })

  test('pied de page entretien : ni mention alcool ni lien mentions légales', async ({ page }) => {
    await page.goto('/entretien')
    const footer = page.getByRole('contentinfo')
    await expect(footer.getByText('Buvez avec modération', { exact: false })).toHaveCount(0)
    await expect(footer.getByRole('link', { name: 'Mentions légales' })).toHaveCount(0)
    await expect(footer.getByRole('link', { name: 'Politique de confidentialité' })).toBeVisible()
  })
})
