<script setup lang="ts">
// Détail d'une candidature : coordonnées, message et documents téléchargeables. Jamais rendu pour
// une candidature anonymisée (les PII sont nulles) — la page ne monte ce composant que si nécessaire.
import { Download } from '@lucide/vue'
import type { AdminCandidatureDto } from '#shared/types/admin'
import { fichierUrl } from '@/utils/placement'

defineProps<{ candidature: AdminCandidatureDto }>()
</script>

<template>
  <div class="space-y-3 text-sm">
    <dl class="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-[auto_1fr]">
      <template v-if="candidature.email">
        <dt class="text-muted-foreground">Courriel</dt>
        <dd class="break-all text-foreground">
          <a :href="`mailto:${encodeURIComponent(candidature.email)}`" class="underline-offset-2 hover:underline">{{ candidature.email }}</a>
        </dd>
      </template>
      <template v-if="candidature.telephone">
        <dt class="text-muted-foreground">Téléphone</dt>
        <dd class="break-words text-foreground">{{ candidature.telephone }}</dd>
      </template>
      <template v-if="candidature.adresseComplete">
        <dt class="text-muted-foreground">Adresse</dt>
        <dd class="break-words text-foreground">{{ candidature.adresseComplete }}</dd>
      </template>
    </dl>

    <p v-if="candidature.message" class="max-w-prose whitespace-pre-line break-words leading-6 text-foreground">
      {{ candidature.message }}
    </p>

    <div v-if="candidature.documents.length > 0" class="space-y-1">
      <p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">Documents</p>
      <ul class="space-y-1">
        <li v-for="document in candidature.documents" :key="document.key">
          <a
            :href="fichierUrl(document.key)"
            class="focus-visible:ring-ring inline-flex min-h-11 items-center gap-1.5 rounded-sm text-foreground underline-offset-2 outline-hidden hover:underline focus-visible:ring-2 md:min-h-9"
            :title="`Télécharger ${document.nomOriginal}`"
          >
            <Download class="size-4" aria-hidden="true" />
            Télécharger {{ document.nomOriginal }}
          </a>
        </li>
      </ul>
    </div>
    <p v-else-if="candidature.aCv" class="text-muted-foreground">Un CV est joint.</p>
    <p v-else class="text-muted-foreground">Aucun document.</p>
  </div>
</template>
