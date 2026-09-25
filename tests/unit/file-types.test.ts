import { describe, expect, it } from 'vitest'
import { extensionForMime, mimeFromExtension, sniffMime } from '../../server/lib/file-types'

const PDF_HEADER = Buffer.from('%PDF-1.7 reste du contenu')
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00])
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
const WEBP_HEADER = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('WEBP', 'latin1'),
])

describe('sniffMime', () => {
  it('should detect a PDF from its magic bytes', () => {
    expect(sniffMime(PDF_HEADER)).toBe('application/pdf')
  })

  it('should detect a PNG from its magic bytes', () => {
    expect(sniffMime(PNG_HEADER)).toBe('image/png')
  })

  it('should detect a JPEG from its magic bytes', () => {
    expect(sniffMime(JPEG_HEADER)).toBe('image/jpeg')
  })

  it('should detect a WebP from its RIFF/WEBP container', () => {
    expect(sniffMime(WEBP_HEADER)).toBe('image/webp')
  })

  it('should reject content whose declared type does not match its bytes', () => {
    const fakeImage = Buffer.from('<script>alert(1)</script>')
    expect(sniffMime(fakeImage)).toBeUndefined()
  })

  it('should reject an empty buffer', () => {
    expect(sniffMime(Buffer.alloc(0))).toBeUndefined()
  })
})

describe('extensionForMime / mimeFromExtension', () => {
  it('should round-trip every allowed type', () => {
    const mimes = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp'] as const
    for (const mime of mimes) {
      expect(mimeFromExtension(extensionForMime(mime))).toBe(mime)
    }
  })

  it('should return undefined for an unknown extension', () => {
    expect(mimeFromExtension('exe')).toBeUndefined()
  })
})
