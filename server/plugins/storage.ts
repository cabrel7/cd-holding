import fsDriver from 'unstorage/drivers/fs'

// Montage du storage `uploads` au démarrage (runtime), et non dans nitro.storage (build time) :
// le chemin vient de NUXT_UPLOADS_DIR lu au lancement du serveur, pas figé dans le bundle.
// Migration S3/R2 plus tard = remplacer le driver ici, sans toucher au code applicatif.
export default defineNitroPlugin(() => {
  const { uploadsDir } = useRuntimeConfig()
  useStorage().mount(UPLOADS_MOUNT, fsDriver({ base: uploadsDir }))
})
