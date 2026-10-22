<script setup lang="ts">
// Déclencheurs d'actions d'une candidature : « Ajouter au vivier », « Supprimer maintenant »
// (anonymisation Loi 25) et « Supprimer ». Chaque confirmation passe par un dialog piloté par la
// page (candidatures.vue), qui reste ouvert tant que la requête n'a pas abouti — ce composant ne
// porte que les boutons. La suppression reste possible sur une candidature déjà anonymisée.
import { ShieldAlert, Trash2, UserPlus } from '@lucide/vue'
import type { AdminCandidatureDto } from '#shared/types/admin'
import { Button } from '@/components/ui/button'

defineProps<{
  candidature: AdminCandidatureDto
  busy: boolean
}>()

const emit = defineEmits<{
  vivier: [candidature: AdminCandidatureDto]
  anonymiser: [candidature: AdminCandidatureDto]
  remove: [candidature: AdminCandidatureDto]
}>()
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <template v-if="candidature.anonymiseLe === null">
      <Button variant="outline" class="min-h-11 md:min-h-9" :disabled="busy" @click="emit('vivier', candidature)">
        <UserPlus aria-hidden="true" />
        Ajouter au vivier
      </Button>
      <Button
        variant="outline"
        class="min-h-11 border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive md:min-h-9"
        :disabled="busy"
        @click="emit('anonymiser', candidature)"
      >
        <ShieldAlert aria-hidden="true" />
        Supprimer maintenant
      </Button>
    </template>
    <Button
      variant="ghost"
      class="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive md:min-h-9"
      :disabled="busy"
      @click="emit('remove', candidature)"
    >
      <Trash2 aria-hidden="true" />
      Supprimer
    </Button>
  </div>
</template>
