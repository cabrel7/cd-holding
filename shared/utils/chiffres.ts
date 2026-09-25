// Résolution des chiffres calculés du catalogue (type `chiffres`, spec §1.4) : les items
// `effectif` et `filiales` ne portent pas de valeur en base, elle est dérivée côté serveur
// (server/services/public, T1) à partir de l'état réel des filiales. Logique pure, testée ici ;
// la lecture des `Company` reste dans le service appelant.
import type { ChiffreItem } from '../content/sections/types'

export interface ContexteChiffres {
  readonly effectifTotal: number
  readonly nombreFiliales: number
}

export interface ChiffreResolu {
  readonly valeur: string
  readonly libelle: string
}

/** Arrondit à la dizaine inférieure (25 → 20, 20 → 20). Jamais négatif. */
export function arrondirDizaineInferieure(valeur: number): number {
  return Math.max(0, Math.floor(valeur / 10) * 10)
}

export function formaterEffectif(valeur: number, arrondi: boolean): string {
  return arrondi ? `${arrondirDizaineInferieure(valeur)}+` : String(valeur)
}

export function resolveChiffreItem(item: ChiffreItem, ctx: ContexteChiffres): ChiffreResolu {
  switch (item.type) {
    case 'libre':
      return { valeur: item.valeur, libelle: item.libelle }
    case 'effectif':
      return { valeur: formaterEffectif(ctx.effectifTotal, item.arrondi), libelle: item.libelle }
    case 'filiales':
      return { valeur: String(ctx.nombreFiliales), libelle: item.libelle }
  }
}

export function resolveChiffres(items: readonly ChiffreItem[], ctx: ContexteChiffres): ChiffreResolu[] {
  return items.map((item) => resolveChiffreItem(item, ctx))
}
