import { describe, expect, it, vi } from 'vitest'
import { escapeHtml } from '../../server/lib/mail/escape'
import { createLogTransport, type MailTransport, type OutgoingMail } from '../../server/lib/mail/transports'
import { accuseReceptionTemplate } from '../../server/lib/mail/templates/accuse-reception'
import { sendMailSafely } from '../../server/utils/mailer'

const SAMPLE_MAIL: OutgoingMail = {
  template: 'accuse-reception',
  to: 'destinataire@exemple.com',
  subject: 'Sujet secret',
  text: 'Corps du message',
  html: '<p>Corps du message</p>',
}

describe('escapeHtml', () => {
  it('escapes the 5 special HTML characters', () => {
    expect(escapeHtml(`<script>&"'`)).toBe('&lt;script&gt;&amp;&quot;&#39;')
  })

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Bonjour Claire')).toBe('Bonjour Claire')
  })
})

describe('accuseReceptionTemplate', () => {
  it('escapes an interpolated variable in the html body but not in the text body', () => {
    const content = accuseReceptionTemplate({ nomDestinataire: '<b>Claire</b>', nomEntreprise: 'Groupe CD' })
    expect(content.html).not.toContain('<b>Claire</b>')
    expect(content.html).toContain('&lt;b&gt;Claire&lt;/b&gt;')
    expect(content.text).toContain('<b>Claire</b>')
  })
})

describe('createLogTransport', () => {
  it('logs only { template, transport } — never the recipient, subject or body', () => {
    const info = vi.fn()
    const transport = createLogTransport({ info })

    return transport.send(SAMPLE_MAIL).then(() => {
      expect(info).toHaveBeenCalledTimes(1)
      const [, context] = info.mock.calls[0] as [string, Record<string, unknown>]
      expect(context).toEqual({ template: 'accuse-reception', transport: 'log' })
      expect(JSON.stringify(context)).not.toContain('destinataire@exemple.com')
      expect(JSON.stringify(context)).not.toContain('Sujet secret')
    })
  })
})

describe('sendMailSafely', () => {
  it('delegates to the transport on success', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const transport: MailTransport = { name: 'log', send }

    await sendMailSafely(transport, SAMPLE_MAIL)

    expect(send).toHaveBeenCalledWith(SAMPLE_MAIL)
  })

  it('swallows a transport failure instead of throwing', async () => {
    const transport: MailTransport = { name: 'smtp', send: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) }

    await expect(sendMailSafely(transport, SAMPLE_MAIL)).resolves.toBeUndefined()
  })
})
