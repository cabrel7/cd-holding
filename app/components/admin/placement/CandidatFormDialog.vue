<script setup lang="ts">
// Dialog générique (création/édition) pour Candidat. Reprend CmsFormDialog sans `siteUuid`
// (non requis ici). Erreurs serveur (409 email) relayées via `serverErrors`.
import type { ZodType } from 'zod'
import type { CmsField } from '#shared/content/sections/types'
import CmsFormDialog from '@/components/cms/CmsFormDialog.vue'

defineProps<{
  open: boolean
  titre: string
  fields: readonly CmsField[]
  schema: ZodType
  initialValues: Record<string, unknown>
  submitting: boolean
  serverErrors?: Record<string, string>
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [values: Record<string, unknown>]
}>()
</script>

<template>
  <CmsFormDialog
    :open="open"
    :titre="titre"
    :description="undefined"
    :fields="fields"
    :schema="schema"
    :initial-values="initialValues"
    site-uuid=""
    :submitting="submitting"
    :server-errors="serverErrors"
    @update:open="(v) => emit('update:open', v)"
    @submit="(v) => emit('submit', v)"
  />
</template>
