// Exemple de référence pour toute route /api/admin/** :
// 1. requireRole (session + rôle)  2. scoping filiale côté serveur  3. requête Prisma
//    avec un select explicite (jamais d'id/companyId numérique exposé au client).
const ALLOWED_ROLES = [ROLES.SUPER_ADMIN, ROLES.ADMIN_FILIALE] as const

export default defineEventHandler(async (event) => {
  const { user, secure } = await requireRole(event, ALLOWED_ROLES)

  return prisma.messageContact.findMany({
    where: companyScope(user, secure),
    orderBy: { createdAt: 'desc' },
    select: {
      uuid: true,
      type: true,
      nom: true,
      email: true,
      telephone: true,
      entreprise: true,
      sujet: true,
      message: true,
      produitSouhaite: true,
      paysOrigine: true,
      details: true,
      statut: true,
      createdAt: true,
      company: { select: { uuid: true, nom: true, slug: true } },
      // volontairement pas de "id" ni "companyId" dans le select — jamais exposés au client
    },
  })
})
