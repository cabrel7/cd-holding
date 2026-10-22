<script setup lang="ts">
// Dialog « Nouveau compte » / « Modifier le compte » (spec lot 6 §5). VeeValidate +
// `toTypedSchema` sur `utilisateurCreateSchema` : le schéma partagé est la seule source des
// règles (nom, courriel, rôle, rattachement). L'édition valide aussi avec ce schéma — le schéma
// update ne tranche pas sur `site` (décision serveur sur l'état fusionné, §3) alors que le
// formulaire exige toujours une filiale hors SUPER_ADMIN (D7) ; le courriel, immuable (D6), est
// affiché en lecture seule et retiré du PATCH. La filiale disparaît pour un super
// administrateur (`companyId` toujours null). Fermé seulement après succès (la page garde `open`).
import { computed, nextTick, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { ROLE_LABELS, UTILISATEUR_TEXT_BOUNDS } from '#shared/config/admin'
import type { FilialeSlug } from '#shared/config/sites'
import type { AdminCompteDto } from '#shared/types/admin'
import { ROLES, type AppRole } from '#shared/utils/roles'
import { utilisateurCreateSchema, type UtilisateurCreateInput, type UtilisateurUpdateInput } from '#shared/validation/utilisateurs'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const props = defineProps<{
  open: boolean
  titre: string
  /** null/absent = création ; sinon compte édité (courriel en lecture seule). */
  compte?: AdminCompteDto | null
  filiales: readonly { readonly value: FilialeSlug; readonly label: string }[]
  submitting: boolean
  /** 409 « courriel déjà utilisé » du serveur, affiché sous le champ courriel. */
  emailError?: string | null
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: UtilisateurCreateInput | UtilisateurUpdateInput]
}>()

const { handleSubmit, errors, defineField, resetForm, setFieldError } = useForm({
  validationSchema: toTypedSchema(utilisateurCreateSchema),
  // Rôle par défaut non-privilegié : créer un super administrateur doit être un choix explicite.
  initialValues: { nom: '', email: '', role: ROLES.ADMIN_FILIALE, site: undefined },
})

const [nom, nomAttrs] = defineField('nom')
const [email, emailAttrs] = defineField('email')
const [role] = defineField('role')
const [site] = defineField('site')

const roleOptions = Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label }))

const estEdition = computed(() => props.compte !== null && props.compte !== undefined)
const showFiliale = computed(() => role.value !== ROLES.SUPER_ADMIN)
const description = computed(() =>
  estEdition.value
    ? "Le courriel de connexion est immuable : recréez un compte pour le corriger. Modifier le rôle ou la filiale déconnecte immédiatement la personne concernée (D12)."
    : 'Un mot de passe temporaire sera généré après la création, à communiquer hors plateforme.',
)

/** Dernier rattachement choisi : restauré si l'admin repasse de SUPER_ADMIN à un rôle de filiale. */
let siteMemo: FilialeSlug | undefined = undefined

watch(role, (nouveau, ancien) => {
  if (nouveau === ROLES.SUPER_ADMIN) {
    siteMemo = site.value
    site.value = undefined
  } else if (ancien === ROLES.SUPER_ADMIN && site.value === undefined && siteMemo !== undefined) {
    site.value = siteMemo
  }
})

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    const compte = props.compte ?? null
    siteMemo = compte?.company?.slug
    resetForm({
      values: {
        nom: compte?.nom ?? '',
        email: compte?.email ?? '',
        role: compte?.role ?? ROLES.ADMIN_FILIALE,
        site: compte?.company?.slug,
      },
    })
  },
)

// 409 courriel déjà utilisé : sous le champ, comme une erreur client, avec renvoi du focus
// (miroir MotDePasseDialog — `<Input>` n'expose pas `focus()`, d'où le querySelector).
const zoneEmail = ref<HTMLElement | null>(null)

watch(
  () => props.emailError,
  async (message) => {
    if (!message) return
    setFieldError('email', message)
    await nextTick()
    zoneEmail.value?.querySelector<HTMLElement>('input')?.focus()
  },
)

function onRoleChange(value: unknown): void {
  role.value = String(value) as AppRole
}

function onSiteChange(value: unknown): void {
  site.value = String(value) as FilialeSlug
}

const onSubmit = handleSubmit((valeurs) => {
  // `site` n'est jamais transmis à un super administrateur (D7) : ni au POST ni au PATCH.
  const rattachement = valeurs.site !== undefined ? { site: valeurs.site } : {}
  if (props.compte) {
    emit('submit', { nom: valeurs.nom, role: valeurs.role, ...rattachement })
  } else {
    emit('submit', { nom: valeurs.nom, email: valeurs.email, role: valeurs.role, ...rattachement })
  }
})

function onOpenChange(value: boolean): void {
  if (!value && props.submitting) return
  emit('update:open', value)
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogContent class="max-h-[85vh] overflow-y-auto sm:max-w-lg" :show-close-button="!submitting">
      <DialogHeader>
        <DialogTitle>{{ titre }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>

      <form class="space-y-4" novalidate @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="compte-nom">Nom *</Label>
          <Input
            id="compte-nom"
            v-model="nom"
            v-bind="nomAttrs"
            type="text"
            :maxlength="UTILISATEUR_TEXT_BOUNDS.nom.max"
            autocomplete="off"
            class="h-11 md:h-10"
            :aria-invalid="!!errors.nom"
            :aria-describedby="errors.nom ? 'compte-nom-err' : undefined"
          />
          <p v-if="errors.nom" id="compte-nom-err" class="text-sm text-destructive" role="alert">{{ errors.nom }}</p>
        </div>

        <div class="space-y-2">
          <Label for="compte-email">Courriel *</Label>
          <div ref="zoneEmail" class="relative">
            <Input
              id="compte-email"
              v-model="email"
              v-bind="emailAttrs"
              type="email"
              :maxlength="UTILISATEUR_TEXT_BOUNDS.email.max"
              :readonly="estEdition"
              autocomplete="off"
              class="h-11 md:h-10"
              :class="estEdition ? 'bg-muted/50 text-muted-foreground' : undefined"
              :aria-invalid="!!errors.email"
              :aria-describedby="errors.email ? 'compte-email-err' : undefined"
            />
          </div>
          <p v-if="errors.email" id="compte-email-err" class="text-sm text-destructive" role="alert">{{ errors.email }}</p>
        </div>

        <div class="space-y-2">
          <Label for="compte-role">Rôle *</Label>
          <Select :model-value="role" @update:model-value="onRoleChange">
            <SelectTrigger
              id="compte-role"
              class="w-full data-[size=default]:h-11 md:data-[size=default]:h-10"
              :aria-invalid="!!errors.role"
              :aria-describedby="errors.role ? 'compte-role-err' : undefined"
            >
              <SelectValue placeholder="Choisissez un rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.role" id="compte-role-err" class="text-sm text-destructive" role="alert">{{ errors.role }}</p>
        </div>

        <div v-if="showFiliale" class="space-y-2">
          <Label for="compte-site">Filiale *</Label>
          <Select :model-value="site" @update:model-value="onSiteChange">
            <SelectTrigger
              id="compte-site"
              class="w-full data-[size=default]:h-11 md:data-[size=default]:h-10"
              :aria-invalid="!!errors.site"
              :aria-describedby="errors.site ? 'compte-site-err' : undefined"
            >
              <SelectValue placeholder="Choisissez une filiale" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="opt in filiales" :key="opt.value" :value="opt.value">{{ opt.label }}</SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.site" id="compte-site-err" class="text-sm text-destructive" role="alert">{{ errors.site }}</p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" class="min-h-11 md:min-h-9" :disabled="submitting" @click="onOpenChange(false)">
            Annuler
          </Button>
          <Button type="submit" class="min-h-11 md:min-h-9" :disabled="submitting" :aria-busy="submitting">
            {{ submitting ? 'Enregistrement…' : 'Enregistrer' }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
