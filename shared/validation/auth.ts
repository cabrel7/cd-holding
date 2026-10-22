import { z } from 'zod'

// Source unique des règles d'authentification, importée côté client (VeeValidate)
// ET côté serveur (readValidatedBody) via l'alias `#shared/validation/auth`.
export const PASSWORD_MIN_LENGTH = 8

export const PASSWORD_TOO_SHORT_MESSAGE = `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`

export const passwordSchema = z
  .string({ required_error: 'Mot de passe requis' })
  .min(PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT_MESSAGE)

export const emailSchema = z
  .string({ required_error: 'Email requis' })
  .trim()
  .toLowerCase()
  .email('Email invalide')

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
})

export type LoginInput = z.infer<typeof loginSchema>

// --- Changement de mot de passe (lot 5 paramètres) -----------------------------------------

export const actuelSchema = z
  .string({ required_error: 'Mot de passe actuel requis' })
  .min(1, 'Mot de passe actuel requis')

export const changementMotDePasseChamps = z
  .object({
    actuel: actuelSchema,
    nouveau: passwordSchema,
  })
  .strict()

function refinerNouveauDifferent(v: { actuel: string; nouveau: string }, ctx: z.RefinementCtx): void {
  if (v.nouveau === v.actuel)
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['nouveau'],
      message: "Le nouveau mot de passe doit être différent de l'actuel.",
    })
}

export const changementMotDePasseSchema = changementMotDePasseChamps.superRefine(refinerNouveauDifferent)

/** Confirmation : message propre à chaque état. Une confirmation laissée vide affiche
 * « Veuillez confirmer… » plutôt que la règle de longueur (un même message sous deux champs
 * se relit mal) ; un champ rempli trop court garde la règle commune. */
export const confirmationSchema = z
  .string({ required_error: 'Veuillez confirmer le nouveau mot de passe.' })
  .min(1, 'Veuillez confirmer le nouveau mot de passe.')
  .refine((v) => v === '' || v.length >= PASSWORD_MIN_LENGTH, { message: PASSWORD_TOO_SHORT_MESSAGE })

/** Fabrique (et non schéma exporté) : zod 3 refuse `.extend()` après `.superRefine()`. */
export function changementMotDePasseDialogSchema() {
  return z
    .object({
      actuel: actuelSchema,
      nouveau: passwordSchema,
      confirmation: confirmationSchema,
    })
    .strict()
    .superRefine((v, ctx) => {
      refinerNouveauDifferent(v, ctx)
      if (v.nouveau !== v.confirmation)
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['confirmation'],
          message: 'Les mots de passe ne correspondent pas.',
        })
    })
}

export type ChangementMotDePasseInput = z.infer<typeof changementMotDePasseSchema>
