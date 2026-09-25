<script setup lang="ts">
// Upload d'image CMS (services, réalisations, équipe, partenaires, sections). Poste vers
// POST /api/admin/files (PUBLIC), voir spec phase 2 §4.5. Erreur d'upload = message sous le
// champ (pas de toast, voir ui-ux §7 "toasts pour les erreurs bloquantes").
import { ref } from 'vue'
import { ImagePlus, Loader2, X } from '@lucide/vue'
import { MAX_UPLOAD_BYTES, PUBLIC_IMAGE_MIMES } from '#shared/config/upload'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  modelValue: string | null
  siteUuid: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const uploading = ref(false)
const uploadError = ref<string | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

const ACCEPT = PUBLIC_IMAGE_MIMES.join(',')

function triggerPick(): void {
  inputRef.value?.click()
}

async function handleFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  uploadError.value = null

  if (!(PUBLIC_IMAGE_MIMES as readonly string[]).includes(file.type)) {
    uploadError.value = 'Format non pris en charge (PNG, JPEG ou WebP).'
    return
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    uploadError.value = 'Fichier trop volumineux (10 Mo maximum).'
    return
  }

  const body = new FormData()
  body.set('file', file)
  body.set('visibilite', 'PUBLIC')
  body.set('companyUuid', props.siteUuid)

  uploading.value = true
  try {
    const result = await $fetch<{ key: string }>('/api/admin/files', { method: 'POST', body })
    emit('update:modelValue', result.key)
  } catch {
    uploadError.value = 'Échec du téléversement. Réessayez.'
  } finally {
    uploading.value = false
  }
}

function remove(): void {
  emit('update:modelValue', null)
  uploadError.value = null
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="modelValue" class="flex items-center gap-3">
      <img :src="`/api/files/${modelValue}`" alt="" class="h-16 w-16 rounded-md border border-border object-cover">
      <Button type="button" variant="outline" size="sm" class="gap-1.5" :disabled="uploading" @click="remove">
        <X class="size-4" aria-hidden="true" /> Retirer
      </Button>
    </div>
    <Button v-else type="button" variant="outline" size="sm" class="gap-1.5" :disabled="uploading" @click="triggerPick">
      <Loader2 v-if="uploading" class="size-4 animate-spin" aria-hidden="true" />
      <ImagePlus v-else class="size-4" aria-hidden="true" />
      {{ uploading ? 'Téléversement…' : 'Choisir une image' }}
    </Button>
    <input
      ref="inputRef"
      type="file"
      :accept="ACCEPT"
      class="sr-only"
      tabindex="-1"
      aria-hidden="true"
      @change="handleFileChange"
    >
    <p v-if="uploadError" class="text-sm text-destructive" role="alert">{{ uploadError }}</p>
  </div>
</template>
