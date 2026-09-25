<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const PASSWORD_MIN_LENGTH = 8
const HTTP_TOO_MANY_REQUESTS = 429

// Pattern de référence : VeeValidate + zod côté client, zod ré-appliqué côté serveur (readValidatedBody).
const schema = toTypedSchema(
  z.object({
    email: z.string({ required_error: 'Email requis' }).trim().email('Email invalide'),
    password: z
      .string({ required_error: 'Mot de passe requis' })
      .min(PASSWORD_MIN_LENGTH, `${PASSWORD_MIN_LENGTH} caractères minimum`),
  }),
)

const { handleSubmit, errors, defineField, isSubmitting } = useForm({ validationSchema: schema })
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const route = useRoute()
const authStore = useAuthStore()

// Redirection post-login limitée aux chemins internes /admin (anti open-redirect)
function safeRedirect(): string {
  const target = route.query.redirect
  if (typeof target === 'string' && target.startsWith(`${ADMIN_HOME_PATH}`) && !target.startsWith('//')) {
    return target
  }
  return ADMIN_HOME_PATH
}

const onSubmit = handleSubmit(async (values) => {
  try {
    await authStore.login(values.email, values.password)
    await navigateTo(safeRedirect())
  } catch (error: unknown) {
    const status = (error as { statusCode?: number }).statusCode
    toast.error(
      status === HTTP_TOO_MANY_REQUESTS
        ? 'Trop de tentatives. Réessayez dans quelques minutes.'
        : 'Identifiants invalides.',
    )
  }
})

useHead({ title: 'Connexion — Administration' })
</script>

<template>
  <main class="flex min-h-svh items-center justify-center bg-muted p-4">
    <Card class="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Administration</CardTitle>
        <CardDescription>Connectez-vous pour accéder au tableau de bord.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="grid gap-4" novalidate @submit="onSubmit">
          <div class="grid gap-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="email"
              v-bind="emailAttrs"
              type="email"
              autocomplete="username"
              :aria-invalid="!!errors.email"
              aria-describedby="email-error"
            />
            <p v-if="errors.email" id="email-error" class="text-sm text-destructive">{{ errors.email }}</p>
          </div>
          <div class="grid gap-2">
            <Label for="password">Mot de passe</Label>
            <Input
              id="password"
              v-model="password"
              v-bind="passwordAttrs"
              type="password"
              autocomplete="current-password"
              :aria-invalid="!!errors.password"
              aria-describedby="password-error"
            />
            <p v-if="errors.password" id="password-error" class="text-sm text-destructive">{{ errors.password }}</p>
          </div>
          <Button type="submit" class="w-full" :disabled="isSubmitting">
            {{ isSubmitting ? 'Connexion…' : 'Se connecter' }}
          </Button>
        </form>
      </CardContent>
    </Card>
  </main>
</template>
