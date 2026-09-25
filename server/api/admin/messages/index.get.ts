// Exemple de référence pour toute route /api/admin/** :
// 1. requireRole (session + rôle)  2. scoping filiale côté serveur  3. requête Prisma.
const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const user = await requireRole(event, ALLOWED_ROLES)

  return prisma.messageContact.findMany({
    where: companyScope(user),
    orderBy: { createdAt: 'desc' },
    include: { company: { select: { nom: true, slug: true } } },
  })
})
