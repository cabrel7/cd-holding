// Détection de type de fichier par octets magiques — pur (aucune dépendance à H3/Nitro/Prisma),
// réutilisé par server/utils/storage.ts (upload applicatif) ET par le générateur de seed (T2,
// import relatif depuis prisma/seed/fichiers.ts). Le Content-Type déclaré par le client
// n'est jamais fiable, seul le contenu réel du fichier l'est.
export const ALLOWED_UPLOAD_TYPES = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const

export type AllowedUploadMime = keyof typeof ALLOWED_UPLOAD_TYPES

export function extensionForMime(mime: AllowedUploadMime): string {
  return ALLOWED_UPLOAD_TYPES[mime]
}

export function mimeFromExtension(ext: string): AllowedUploadMime | undefined {
  return (Object.keys(ALLOWED_UPLOAD_TYPES) as AllowedUploadMime[]).find((mime) => ALLOWED_UPLOAD_TYPES[mime] === ext)
}

/** Détecte le type réel d'un buffer via ses octets magiques. */
export function sniffMime(data: Uint8Array): AllowedUploadMime | undefined {
  const buf = Buffer.isBuffer(data) ? data : Buffer.from(data)

  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') {
    return 'image/webp'
  }
  return undefined
}
