// Aides communes aux 4 services de collection CMS (services, réalisations, équipe, partenaires) —
// mapping du site (`Company` → `CmsSiteRef`, cast à la frontière Prisma, voir T0) et planification
// d'un réordonnancement transactionnel « ensemble exact » (spec §4.2).
import type { CmsSiteRef } from '#shared/types/cms'
import { toSiteSlug } from '../../utils/site-scope'

export const SITE_REF_SELECT = { uuid: true, slug: true, nom: true } as const

export interface CompanyRefRow {
  readonly uuid: string
  readonly slug: string
  readonly nom: string
}

export function toCmsSiteRef(company: CompanyRefRow): CmsSiteRef {
  return { uuid: company.uuid, slug: toSiteSlug(company.slug), nom: company.nom }
}

export interface ReorderRow {
  readonly id: number
  readonly uuid: string
}

/**
 * Vérifie que `uuids` couvre EXACTEMENT `rows` (spec §4.2 : "ensemble exact du site") puis
 * retourne le plan id → nouvel ordre. Lève 400 (ensemble incomplet, uuid étranger à la filiale)
 * plutôt qu'une écriture partielle silencieuse.
 */
export function planReorder(rows: readonly ReorderRow[], uuids: readonly string[]): Map<number, number> {
  if (rows.length !== uuids.length) {
    throw createError({ statusCode: 400, statusMessage: 'La liste ne couvre pas exactement les fiches de cette filiale' })
  }
  const idByUuid = new Map(rows.map((row) => [row.uuid, row.id]))
  const plan = new Map<number, number>()
  uuids.forEach((uuid, index) => {
    const id = idByUuid.get(uuid)
    if (id === undefined) {
      throw createError({ statusCode: 400, statusMessage: 'La liste ne couvre pas exactement les fiches de cette filiale' })
    }
    plan.set(id, index)
  })
  return plan
}

/** 'YYYY-MM-DD' (ou null) ← Date stockée à minuit UTC (Realisation.dateRealisation). */
export function dateOnlyFromDate(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null
}

/** Date à minuit UTC ← 'YYYY-MM-DD' (ou null), pour l'écriture Prisma. */
export function dateFromDateOnly(value: string | null): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null
}
