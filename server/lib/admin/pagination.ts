// Pagination offset commune aux listes admin (pure, testée).
import type { AdminPage } from '#shared/types/admin'
import { estViolationUnique } from '../reservation'

export function pageArgs(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize }
}

/** Page hors bornes : `items` vide et vrai `total` (le client recadre sur la dernière page). */
export function buildPage<T>(items: readonly T[], total: number, page: number, pageSize: number): AdminPage<T> {
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
}

export const isUniqueViolation: (error: unknown) => boolean = estViolationUnique
