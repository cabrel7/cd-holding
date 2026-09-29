// Pagination offset commune aux listes admin (pure, testée).
import type { AdminPage } from '#shared/types/admin'

export function pageArgs(page: number, pageSize: number): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize }
}

/** Page hors bornes : `items` vide et vrai `total` (le client recadre sur la dernière page). */
export function buildPage<T>(items: readonly T[], total: number, page: number, pageSize: number): AdminPage<T> {
  return { items, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) }
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002'
}
