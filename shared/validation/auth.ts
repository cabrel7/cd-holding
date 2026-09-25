import { z } from 'zod'

// Source unique des règles d'authentification, importée côté client (VeeValidate)
// ET côté serveur (readValidatedBody) via l'alias `#shared/validation/auth`.
export const PASSWORD_MIN_LENGTH = 8

export const passwordSchema = z
  .string({ required_error: 'Mot de passe requis' })
  .min(PASSWORD_MIN_LENGTH, `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`)

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
