import { loginSchema } from '#shared/validation/auth'

const LOGIN_RATE_LIMIT = { scope: 'login', max: 5, windowMs: 15 * 60 * 1000 } as const
const INVALID_CREDENTIALS = 'Identifiants invalides'
// Corps JSON attendu : email + mot de passe, quelques centaines d'octets suffisent largement.
// Rejeté avant lecture pour éviter qu'un corps non authentifié arbitrairement gros soit
// entièrement chargé en mémoire par readValidatedBody (déni de service).
const MAX_LOGIN_BODY_BYTES = 4 * 1024

// Hash factice calculé une fois : vérifié quand l'email n'existe pas, pour que le temps
// de réponse ne révèle pas si un compte existe (énumération par timing).
let dummyHash: Promise<string> | undefined
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('dummy-password-for-timing-equalization')
  return dummyHash
}

export default defineEventHandler(async (event) => {
  assertRateLimit(event, LOGIN_RATE_LIMIT)

  const contentLength = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (!contentLength || contentLength > MAX_LOGIN_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Requête trop volumineuse' })
  }

  const body = await readValidatedBody(event, loginSchema.parse)

  const user = await prisma.user.findUnique({
    where: { email: body.email },
    select: {
      id: true,
      uuid: true,
      nom: true,
      role: true,
      passwordHash: true,
      actif: true,
      company: { select: { id: true, uuid: true } },
    },
  })

  const valid = user
    ? await verifyPassword(user.passwordHash, body.password)
    : await verifyPassword(await getDummyHash(), body.password).then(() => false)

  if (!user || !valid || !user.actif) {
    throw createError({ statusCode: 401, statusMessage: INVALID_CREDENTIALS })
  }

  resetRateLimit(event, LOGIN_RATE_LIMIT.scope)

  await setUserSession(event, {
    user: {
      uuid: user.uuid,
      nom: user.nom,
      role: user.role,
      companyUuid: user.company?.uuid ?? null,
    },
    secure: {
      userId: user.id,
      companyId: user.company?.id ?? null,
    },
    loggedInAt: Date.now(),
  })

  return { ok: true }
})
