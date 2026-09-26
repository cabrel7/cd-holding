<script setup lang="ts">
// Champ honeypot anti-bot (spec §3.2 étape 5, §4.1) : masqué visuellement et du clavier
// (tabindex=-1, hors flux), jamais rempli par un humain. Un remplissage fait simuler un succès
// par le serveur, sans écriture ni courriel — ce champ ne doit donc jamais recevoir de vraie
// saisie ; `autocomplete="off"` limite le pré-remplissage par le navigateur.
const modelValue = defineModel<string | undefined>({ default: '' })

const id = useId()
</script>

<template>
  <div class="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
    <label :for="id">Ne pas remplir ce champ</label>
    <input :id="id" v-model="modelValue" type="text" name="website" tabindex="-1" autocomplete="off">
  </div>
</template>
