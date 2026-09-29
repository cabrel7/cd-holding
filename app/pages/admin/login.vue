<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { loginSchema } from '#shared/validation/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ADMIN_GROUP_NAME } from '@/config/admin-nav'

// Le middleware `admin` renvoie déjà vers la cible sûre un utilisateur connecté.
definePageMeta({ layout: false, middleware: 'admin' })

const HTTP_UNAUTHORIZED = 401
const HTTP_TOO_MANY_REQUESTS = 429

const MESSAGES_ERREUR = {
  [HTTP_UNAUTHORIZED]: 'Identifiants invalides. Vérifiez votre courriel et votre mot de passe.',
  [HTTP_TOO_MANY_REQUESTS]: 'Trop de tentatives. Réessayez dans quelques minutes.',
} as const
const MESSAGE_ERREUR_DEFAUT = 'Connexion impossible pour le moment. Réessayez.'

// Source unique de validation (client + serveur) : shared/validation/auth.ts. Le schéma applique
// trim + minuscules à la soumission seulement ; le v-model garde la saisie brute.
const { handleSubmit, errors, defineField, isSubmitting } = useForm({
  validationSchema: toTypedSchema(loginSchema),
})
const [email, emailAttrs] = defineField('email')
const [password, passwordAttrs] = defineField('password')

const route = useRoute()
const authStore = useAuthStore()
const erreur = ref<string | null>(null)

function messagePourStatut(error: unknown): string {
  const status = (error as { statusCode?: number } | null)?.statusCode
  if (status === HTTP_UNAUTHORIZED || status === HTTP_TOO_MANY_REQUESTS) return MESSAGES_ERREUR[status]
  return MESSAGE_ERREUR_DEFAUT
}

const onSubmit = handleSubmit(async (values) => {
  erreur.value = null
  try {
    await authStore.login(values.email, values.password)
  } catch (error: unknown) {
    erreur.value = messagePourStatut(error)
    return
  }
  await navigateTo(safeAdminRedirect(route.query.redirect))
})

useHead({ title: 'Connexion — Administration' })
</script>

<template>
  <div class="bg-background flex min-h-svh">
    <aside class="bg-navy text-cream hidden w-1/2 flex-col justify-between p-12 lg:flex">
      <NuxtLink to="/" class="focus-visible:ring-gold flex min-h-11 w-fit items-center rounded-md outline-hidden focus-visible:ring-2">
        <span class="font-display text-lg font-semibold">{{ ADMIN_GROUP_NAME }}</span>
      </NuxtLink>
      <div>
        <p class="font-display text-5xl leading-tight font-semibold">
          Console<br />d'administration.
        </p>
        <p class="text-cream/80 mt-6 max-w-sm text-base">
          Gérez le contenu, les messages et les clients de vos sites depuis une seule interface.
        </p>
      </div>
      <p class="text-cream/70 text-xs">Accès réservé aux membres autorisés.</p>
    </aside>

    <main class="flex w-full items-center justify-center p-6 lg:w-1/2">
      <div class="w-full max-w-md">
        <div class="mb-8">
          <h1 class="font-display text-navy text-3xl font-semibold">Connexion</h1>
          <p class="text-muted-foreground mt-2 text-sm">Entrez vos identifiants pour accéder à la console.</p>
        </div>

        <form class="space-y-5" novalidate @submit.prevent="onSubmit">
          <div class="space-y-2">
            <Label for="email">Courriel</Label>
            <Input
              id="email"
              v-model="email"
              v-bind="emailAttrs"
              type="email"
              autocomplete="username"
              class="h-11"
              :aria-invalid="!!errors.email"
              :aria-describedby="errors.email ? 'email-error' : undefined"
            />
            <p v-if="errors.email" id="email-error" class="text-destructive text-sm">{{ errors.email }}</p>
          </div>

          <div class="space-y-2">
            <Label for="password">Mot de passe</Label>
            <Input
              id="password"
              v-model="password"
              v-bind="passwordAttrs"
              type="password"
              autocomplete="current-password"
              class="h-11"
              :aria-invalid="!!errors.password"
              :aria-describedby="errors.password ? 'password-error' : undefined"
            />
            <p v-if="errors.password" id="password-error" class="text-destructive text-sm">{{ errors.password }}</p>
          </div>

          <div role="alert">
            <p
              v-if="erreur"
              class="border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-3 py-2 text-sm"
            >
              {{ erreur }}
            </p>
          </div>

          <Button type="submit" class="h-11 w-full" :disabled="isSubmitting">
            {{ isSubmitting ? 'Connexion en cours…' : 'Se connecter' }}
          </Button>
        </form>
      </div>
    </main>
  </div>
</template>
