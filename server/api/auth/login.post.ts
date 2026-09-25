import { z } from 'zod'

const LOGIN_RATE_LIMIT = { scope: 'login', max: 10, windowMs: 15 * 60 * 1000 } as const
const PASSWORD_MIN_LENGTH = 8
const INVALID_CREDENTIALS = 'Identifiants invalides'

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
})

// Hash factice calculé une fois : vérifié quand l'email n'existe pas, pour que le temps
// de réponse ne révèle pas si un compte existe (énumération par timing).
let dummyHash: Promise<string> | undefined
function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('dummy-password-for-timing-equalization')
  return dummyHash
}

export default defineEventHandler(async (event) => {
  assertRateLimit(event, LOGIN_RATE_LIMIT)

  const body = await readValidatedBody(event, loginSchema.parse)

  const user = await prisma.user.findUnique({ where: { email: body.email } })

  const valid = user
    ? await verifyPassword(user.passwordHash, body.password)
    : await verifyPassword(await getDummyHash(), body.password).then(() => false)

  if (!user || !valid || !user.actif) {
    throw createError({ statusCode: 401, statusMessage: INVALID_CREDENTIALS })
  }

  resetRateLimit(event, LOGIN_RATE_LIMIT.scope)

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      nom: user.nom,
      role: user.role,
      companyId: user.companyId,
    },
    loggedInAt: Date.now(),
  })

  return { ok: true }
})
