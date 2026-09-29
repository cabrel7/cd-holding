// GET /api/admin/dashboard : synthèse par site + derniers messages (SA, AF).
import { getDashboard } from '../../services/admin/dashboard'

const ROLES_LOT = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const ctx = await requireRole(event, ROLES_LOT)
  setResponseHeader(event, 'cache-control', 'no-store')
  return getDashboard(ctx)
})
