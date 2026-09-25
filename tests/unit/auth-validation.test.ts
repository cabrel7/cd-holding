import { describe, expect, it } from 'vitest'
// Alias `#shared/validation/auth` résolu par la config Vite de Nuxt (voir vitest.config.ts) :
// pas besoin de booter le runtime Nuxt pour que l'alias fonctionne dans ce test.
import { loginSchema, passwordSchema } from '#shared/validation/auth'

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
