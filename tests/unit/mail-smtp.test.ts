import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSmtpTransport, type SmtpTransportConfig } from '../../server/lib/mail/transports'

const { createTransport, sendMail } = vi.hoisted(() => {
  const sendMail = vi.fn<() => Promise<void>>().mockResolvedValue(undefined)
  const createTransport = vi.fn<(options: Record<string, unknown>) => { sendMail: typeof sendMail }>(() => ({
    sendMail,
  }))
  return { createTransport, sendMail }
})

vi.mock('nodemailer', () => ({ default: { createTransport } }))

const CONFIG: SmtpTransportConfig = {
  host: 'smtp.example.test',
  port: 587,
  secure: false,
  user: 'user@example.test',
  password: 'secret-example',
  from: 'site@example.test',
}

describe('createSmtpTransport', () => {
  beforeEach(() => {
    createTransport.mockClear()
    sendMail.mockClear()
  })

  it('force STARTTLS (requireTLS) quand la connexion n’est pas TLS implicite', () => {
    createSmtpTransport(CONFIG)
    expect(createTransport).toHaveBeenCalledTimes(1)
    const options = createTransport.mock.calls[0]![0]
    expect(options).toMatchObject({
      host: 'smtp.example.test',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: 'user@example.test', pass: 'secret-example' },
    })
  })

  it('ne force pas STARTTLS en TLS implicite (port 465)', () => {
    createSmtpTransport({ ...CONFIG, port: 465, secure: true })
    const options = createTransport.mock.calls[0]![0]
    expect(options).toMatchObject({ port: 465, secure: true, requireTLS: false })
  })

  it('transmet from/to/replyTo/subject/text/html inchangés à nodemailer', async () => {
    const transport = createSmtpTransport(CONFIG)
    await transport.send({
      template: 'test',
      to: 'dest@example.test',
      replyTo: 'expediteur@example.test',
      subject: 'Sujet',
      text: 'corps',
      html: '<p>corps</p>',
    })
    expect(sendMail).toHaveBeenCalledWith({
      from: 'site@example.test',
      to: 'dest@example.test',
      replyTo: 'expediteur@example.test',
      subject: 'Sujet',
      text: 'corps',
      html: '<p>corps</p>',
    })
  })
})
