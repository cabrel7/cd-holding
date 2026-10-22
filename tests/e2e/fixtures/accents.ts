// Table des accents de marque par site (spec phase 2 §6, recopiée depuis `prisma/seed/companies.ts`
// et `couleurAccent` de la holding) — le test e2e ne lit ni le seed ni la base (spec §4.8), la
// donnée est donc dupliquée ici volontairement et doit être tenue à jour si les accents changent.
export const SITE_ACCENTS: Record<string, string> = {
  holding: '#1B2A4A',
  entretien: '#0F6E56',
  transport: '#D85A30',
  comptable: '#185FA5',
  placement: '#D4537E',
  cdpaa: '#BA7517',
  boissons: '#A32D2D',
}

/** Convertit un hex `#RRGGBB` vers la forme `rgb(r, g, b)` renvoyée par `getComputedStyle`. */
export function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = Number.parseInt(clean.slice(0, 2), 16)
  const g = Number.parseInt(clean.slice(2, 4), 16)
  const b = Number.parseInt(clean.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}
