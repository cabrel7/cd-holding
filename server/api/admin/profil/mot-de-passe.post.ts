// POST /api/admin/profil/mot-de-passe : changement du mot de passe du compte connecté
// (spec lot 5 §3). Orchestration reprise de login.post.ts, dans cet ordre (D7) :
// requireRole → rate-limit → garde de corps 4 Ko → zod. La crypto (hashPassword /
// verifyPassword, auto-imports Nitro) vit ICI, jamais dans le service.
import { MESSAGE_ACTUEL_INCORRECT } from '#shared/config/admin'
import { changementMotDePasseSchema } from '#shared/validation/auth'
import {
  enregistrerMotDePasse,
  lireComptePourMotDePasse,
  ROLES_PROFIL,
} from '../../../services/admin/profil'

// Scope distinct de `login` : un changement de mdp n'épuise pas le quota de connexion.
const MOT_DE_PASSE_RATE_LIMIT = { scope: 'profil-mot-de-passe', max: 5, windowMs: 15 * 60 * 1000 } as const
// Corps : mot de passe actuel + nouveau, quelques centaines d'octets suffisent largement.
// Rejeté avant lecture pour éviter qu'un corps arbitrairement gros soit entièrement chargé
// en mémoire par readValidatedBody (déni de service).
const MAX_BODY_BYTES = 4 * 1024

export default defineEventHandler(async (event) => {
  const { secure } = await requireRole(event, ROLES_PROFIL)
  assertRateLimit(event, MOT_DE_PASSE_RATE_LIMIT)

  const contentLength = Number(getRequestHeader(event, 'content-length') ?? 0)
  if (!contentLength || contentLength > MAX_BODY_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Requête trop volumineuse' })
  }

  const body = await readValidatedBody(event, changementMotDePasseSchema.parse)

  const compte = await lireComptePourMotDePasse(secure.userId)
  if (compte === null) {
    // Défensif seulement : requireAuth a déjà validé l'existence et l'activation du compte
    // (D8) juste avant — ce 401 ne couvre qu'une course entre les deux lectures.
    throw createError({ statusCode: 401, statusMessage: 'Session invalide, veuillez vous reconnecter' })
  }

  const valide = await verifyPassword(compte.passwordHash, body.actuel)
  if (!valide) {
    // 400 et jamais 401 : un 401 déclencherait la déconnexion de l'UI pour une faute de
    // saisie (D5) — le 401 reste réservé aux vraies sessions mortes.
    throw createError({ statusCode: 400, statusMessage: MESSAGE_ACTUEL_INCORRECT })
  }

  const hash = await hashPassword(body.nouveau)
  // Ordre imposé (D10, §2.3) : update DB (passwordHash + passwordChangedAt) PUIS bump de
  // `loggedInAt` — la session courante survit, toutes les autres reçoivent 401. Fusion
  // (setUserSession = update, pas replace) : user et secure restent intacts.
  await enregistrerMotDePasse(secure.userId, hash)
  await setUserSession(event, { loggedInAt: Date.now() })

  // Sans remise à zéro, 5 changements réussis = 15 min de blocage (IP partagée derrière un NAT).
  resetRateLimit(event, MOT_DE_PASSE_RATE_LIMIT.scope)

  setResponseHeader(event, 'cache-control', 'no-store')
  return { ok: true }
})
