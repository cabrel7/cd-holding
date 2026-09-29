<script setup lang="ts">
// Un message reçu : ligne d'une liste (pas de carte), toutes les informations lisibles sans
// ouvrir de détail. Le contenu est rendu en texte (`whitespace-pre-line`), jamais en HTML.
import { computed, useId } from 'vue'
import { Trash2, UserPlus } from '@lucide/vue'
import { ORIGINE_FORMULAIRE_LABELS, STATUT_MESSAGE_LABELS, TYPE_MESSAGE_LABELS } from '#shared/config/admin'
import { formatDateHeureQuebec } from '#shared/utils/dates'
import type { AdminMessageDto, StatutMessageDto } from '#shared/types/admin'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const props = defineProps<{
  message: AdminMessageDto
  busy: boolean
  /** Affiche le nom du site (utile au super administrateur). */
  showSite: boolean
}>()

const emit = defineEmits<{
  statut: [statut: StatutMessageDto]
  'add-client': []
  remove: []
}>()

const selectId = useId()

const sujet = computed(() => props.message.sujet ?? 'Sans objet')
const origine = computed(() =>
  props.message.formulaire ? ORIGINE_FORMULAIRE_LABELS[props.message.formulaire] : TYPE_MESSAGE_LABELS[props.message.type],
)
const badgeVariant = computed(() => {
  if (props.message.statut === 'NOUVEAU') return 'default'
  return props.message.statut === 'EN_COURS' ? 'secondary' : 'outline'
})
const contacts = computed(() =>
  [props.message.entreprise, props.showSite ? props.message.site.nom : null, origine.value].filter(
    (v): v is string => typeof v === 'string' && v !== '',
  ),
)
const statutOptions = Object.entries(STATUT_MESSAGE_LABELS) as [StatutMessageDto, string][]
</script>

<template>
  <article class="space-y-3 border-b border-border py-5" :aria-busy="busy">
    <div class="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
      <div class="flex min-w-0 flex-wrap items-center gap-2">
        <h2 class="text-base font-semibold text-foreground">{{ sujet }}</h2>
        <Badge :variant="badgeVariant">{{ STATUT_MESSAGE_LABELS[message.statut] }}</Badge>
      </div>
      <time :datetime="message.createdAt" class="text-sm text-muted-foreground">
        {{ formatDateHeureQuebec(message.createdAt) }}
      </time>
    </div>

    <p class="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
      <span class="font-medium text-foreground">{{ message.nom }}</span>
      <span aria-hidden="true">·</span>
      <a :href="`mailto:${message.email}`" class="break-all underline-offset-2 hover:underline">{{ message.email }}</a>
      <template v-if="message.telephone">
        <span aria-hidden="true">·</span>
        <a :href="`tel:${message.telephone}`" class="underline-offset-2 hover:underline">{{ message.telephone }}</a>
      </template>
      <template v-for="info in contacts" :key="info">
        <span aria-hidden="true">·</span>
        <span>{{ info }}</span>
      </template>
    </p>

    <p class="max-w-prose whitespace-pre-line break-words text-sm leading-6 text-foreground">{{ message.message }}</p>

    <dl v-if="message.champs.length > 0" class="grid max-w-prose grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
      <template v-for="champ in message.champs" :key="champ.libelle">
        <dt class="text-muted-foreground">{{ champ.libelle }}</dt>
        <dd class="break-words text-foreground sm:col-start-2">{{ champ.valeur }}</dd>
      </template>
    </dl>

    <div class="flex flex-wrap items-end gap-3 pt-1">
      <div class="space-y-1.5">
        <Label :for="selectId" class="text-xs text-muted-foreground">Statut</Label>
        <Select
          :model-value="message.statut"
          :disabled="busy"
          @update:model-value="(v) => emit('statut', v as StatutMessageDto)"
        >
          <SelectTrigger :id="selectId" class="w-44 data-[size=default]:h-11 md:data-[size=default]:h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="[value, label] in statutOptions" :key="value" :value="value">{{ label }}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" class="min-h-11 md:min-h-9" :disabled="busy" @click="emit('add-client')">
        <UserPlus aria-hidden="true" />
        Ajouter aux clients
      </Button>
      <Button
        variant="ghost"
        class="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive md:min-h-9"
        :disabled="busy"
        @click="emit('remove')"
      >
        <Trash2 aria-hidden="true" />
        Supprimer
      </Button>
    </div>
  </article>
</template>
