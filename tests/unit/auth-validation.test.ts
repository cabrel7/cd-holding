import { describe, expect, it } from 'vitest'
// Alias `#shared/validation/auth` résolu par la config Vite de Nuxt (voir vitest.config.ts) :
// pas besoin de booter le runtime Nuxt pour que l'alias fonctionne dans ce test.
import {
  changementMotDePasseDialogSchema,
  changementMotDePasseSchema,
  loginSchema,
  PASSWORD_TOO_SHORT_MESSAGE,
  passwordSchema,
} from '#shared/validation/auth'

describe('passwordSchema', () => {
  it('should reject a 5-character password with the French length message', () => {
    // Arrange
    const tooShort = 'abcde'

    // Act
    const result = passwordSchema.safeParse(tooShort)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Le mot de passe doit contenir au moins 8 caractères',
      )
    }
  })

  it('should reject an empty password', () => {
    // Arrange
    const empty = ''

    // Act
    const result = passwordSchema.safeParse(empty)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'Le mot de passe doit contenir au moins 8 caractères',
      )
    }
  })

  it('should accept a password of exactly 8 characters', () => {
    // Arrange
    const exactlyMin = 'exactly8'

    // Act
    const result = passwordSchema.safeParse(exactlyMin)

    // Assert
    expect(result.success).toBe(true)
  })

  it('should accept a password longer than 8 characters', () => {
    // Arrange
    const longEnough = 'a-much-longer-password-123'

    // Act
    const result = passwordSchema.safeParse(longEnough)

    // Assert
    expect(result.success).toBe(true)
  })

  it('should reject a missing password with the French required message', () => {
    // Arrange
    const missing = undefined

    // Act
    const result = passwordSchema.safeParse(missing)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('Mot de passe requis')
    }
  })

  it('should reject a non-string password (unexpected type)', () => {
    // Arrange
    const wrongType = 12345678

    // Act
    const result = passwordSchema.safeParse(wrongType)

    // Assert
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('should accept a valid email and a valid password', () => {
    // Arrange
    const input = { email: 'user@example.com', password: 'validpass' }

    // Act
    const result = loginSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(true)
  })

  it('should reject an invalid email format', () => {
    // Arrange
    const input = { email: 'not-an-email', password: 'validpass' }

    // Act
    const result = loginSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailIssue = result.error.issues.find((issue) => issue.path[0] === 'email')
      expect(emailIssue?.message).toBe('Email invalide')
    }
  })

  it('should normalize the email by trimming whitespace and lowercasing it', () => {
    // Arrange
    const input = { email: '  USER@Example.COM  ', password: 'validpass' }

    // Act
    const result = loginSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBe('user@example.com')
    }
  })

  it('should reject when both email and password are missing, with distinct French messages', () => {
    // Arrange
    const input = {}

    // Act
    const result = loginSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailIssue = result.error.issues.find((issue) => issue.path[0] === 'email')
      const passwordIssue = result.error.issues.find((issue) => issue.path[0] === 'password')
      expect(emailIssue?.message).toBe('Email requis')
      expect(passwordIssue?.message).toBe('Mot de passe requis')
    }
  })

  it('should reject when email is missing but password is present', () => {
    // Arrange
    const input = { password: 'validpass' }

    // Act
    const result = loginSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const emailIssue = result.error.issues.find((issue) => issue.path[0] === 'email')
      expect(emailIssue?.message).toBe('Email requis')
      expect(result.error.issues.some((issue) => issue.path[0] === 'password')).toBe(false)
    }
  })

  it('should reject a null payload (unexpected type, not merely missing fields)', () => {
    // Arrange
    const input = null

    // Act
    const result = loginSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
  })
})

describe('changementMotDePasseSchema', () => {
  it('should reject an unknown key (strict object)', () => {
    // Arrange
    const input = { actuel: 'ancien-mot-de-passe', nouveau: 'nouveau-mot-de-passe', role: 'SUPER_ADMIN' }

    // Act
    const result = changementMotDePasseSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.code === 'unrecognized_keys')).toBe(true)
    }
  })

  it('should reject the client-only confirmation field, locking the POST contract', () => {
    // Arrange
    const input = {
      actuel: 'ancien-mot-de-passe',
      nouveau: 'nouveau-mot-de-passe',
      confirmation: 'nouveau-mot-de-passe',
    }

    // Act
    const result = changementMotDePasseSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) => issue.code === 'unrecognized_keys' && issue.keys.includes('confirmation'),
        ),
      ).toBe(true)
    }
  })

  it('should reject a missing actuel with the French required message', () => {
    // Arrange
    const input = { nouveau: 'nouveau-mot-de-passe' }

    // Act
    const result = changementMotDePasseSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const actuelIssue = result.error.issues.find((issue) => issue.path[0] === 'actuel')
      expect(actuelIssue?.message).toBe('Mot de passe actuel requis')
    }
  })

  it('should reject an empty actuel with the French required message', () => {
    // Arrange
    const input = { actuel: '', nouveau: 'nouveau-mot-de-passe' }

    // Act
    const result = changementMotDePasseSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const actuelIssue = result.error.issues.find((issue) => issue.path[0] === 'actuel')
      expect(actuelIssue?.message).toBe('Mot de passe actuel requis')
    }
  })

  it('should reject a nouveau shorter than 8 characters with the French length message', () => {
    // Arrange
    const input = { actuel: 'ancien-mot-de-passe', nouveau: 'abcde' }

    // Act
    const result = changementMotDePasseSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const nouveauIssue = result.error.issues.find((issue) => issue.path[0] === 'nouveau')
      expect(nouveauIssue?.message).toBe('Le mot de passe doit contenir au moins 8 caractères')
    }
  })

  it('should reject nouveau equal to actuel, under the nouveau path with the exact message', () => {
    // Arrange
    const input = { actuel: 'abcdefgh', nouveau: 'abcdefgh' }

    // Act
    const result = changementMotDePasseSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const nouveauIssue = result.error.issues.find((issue) => issue.path[0] === 'nouveau')
      expect(nouveauIssue?.path).toEqual(['nouveau'])
      expect(nouveauIssue?.message).toBe("Le nouveau mot de passe doit être différent de l'actuel.")
    }
  })

  it('should accept a valid actuel/nouveau pair', () => {
    // Arrange
    const input = { actuel: 'ancien-mot-de-passe', nouveau: 'nouveau-mot-de-passe' }

    // Act
    const result = changementMotDePasseSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(input)
    }
  })

  it('should not trim the passwords (a trailing space is significant)', () => {
    // Arrange
    const input = { actuel: 'abcdefgh', nouveau: 'abcdefgh ' }

    // Act
    const result = changementMotDePasseSchema.safeParse(input)

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.nouveau).toBe('abcdefgh ')
    }
  })
})

describe('changementMotDePasseDialogSchema', () => {
  it('should reject a confirmation differing from nouveau, under the confirmation path', () => {
    // Arrange
    const input = {
      actuel: 'ancien-mot-de-passe',
      nouveau: 'nouveau-mot-de-passe',
      confirmation: 'autre-mot-de-passe',
    }

    // Act
    const result = changementMotDePasseDialogSchema().safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const confirmationIssue = result.error.issues.find((issue) => issue.path[0] === 'confirmation')
      expect(confirmationIssue?.path).toEqual(['confirmation'])
      expect(confirmationIssue?.message).toBe('Les mots de passe ne correspondent pas.')
    }
  })

  it('should reject nouveau equal to actuel even when the confirmation matches', () => {
    // Arrange
    const input = { actuel: 'abcdefgh', nouveau: 'abcdefgh', confirmation: 'abcdefgh' }

    // Act
    const result = changementMotDePasseDialogSchema().safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const nouveauIssue = result.error.issues.find((issue) => issue.path[0] === 'nouveau')
      expect(nouveauIssue?.path).toEqual(['nouveau'])
      expect(nouveauIssue?.message).toBe("Le nouveau mot de passe doit être différent de l'actuel.")
    }
  })

  it('should reject a missing confirmation with its own required message', () => {
    // Arrange
    const input = { actuel: 'ancien-mot-de-passe', nouveau: 'nouveau-mot-de-passe' }

    // Act
    const result = changementMotDePasseDialogSchema().safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const confirmationIssue = result.error.issues.find((issue) => issue.path[0] === 'confirmation')
      expect(confirmationIssue?.message).toBe('Veuillez confirmer le nouveau mot de passe.')
    }
  })

  it('should ask for the confirmation instead of repeating the length rule when it is left empty', () => {
    // Arrange : `nouveau` trop court + confirmation vierge — le message de longueur sous les
    // deux champs se relit mal.
    const input = { actuel: 'ancien-mot-de-passe', nouveau: 'court12', confirmation: '' }

    // Act
    const result = changementMotDePasseDialogSchema().safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const confirmationIssue = result.error.issues.find((issue) => issue.path[0] === 'confirmation')
      expect(confirmationIssue?.message).toBe('Veuillez confirmer le nouveau mot de passe.')
      const longueur = result.error.issues.filter((issue) => issue.message === PASSWORD_TOO_SHORT_MESSAGE)
      expect(longueur.map((issue) => issue.path[0])).toEqual(['nouveau'])
    }
  })

  it('should keep the shared length rule on a confirmation filled too short', () => {
    // Arrange
    const input = { actuel: 'ancien-mot-de-passe', nouveau: 'nouveau-mot-de-passe', confirmation: 'court12' }

    // Act
    const result = changementMotDePasseDialogSchema().safeParse(input)

    // Assert
    expect(result.success).toBe(false)
    if (!result.success) {
      const confirmationIssue = result.error.issues.find((issue) => issue.path[0] === 'confirmation')
      expect(confirmationIssue?.message).toBe(PASSWORD_TOO_SHORT_MESSAGE)
    }
  })

  it('should accept a valid payload', () => {
    // Arrange
    const input = {
      actuel: 'ancien-mot-de-passe',
      nouveau: 'nouveau-mot-de-passe',
      confirmation: 'nouveau-mot-de-passe',
    }

    // Act
    const result = changementMotDePasseDialogSchema().safeParse(input)

    // Assert
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual(input)
    }
  })
})
