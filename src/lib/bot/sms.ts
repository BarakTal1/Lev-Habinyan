// SMS for danger alerts. No vendor is chosen yet (decide after a price check of Israeli providers).
// Until then makeSmsFromEnv always throws SmsNotConfigured, and the alert records the SMS as failed. WhatsApp inside the window still goes out.

export interface SmsSender { send(to: string, body: string): Promise<void> }

export class SmsNotConfigured extends Error {
  constructor(reason = "SMS_API_KEY is not set") { super(reason); this.name = "SmsNotConfigured"; }
}

/** A sender for tests. It remembers what it sent, and fails on demand. */
export class FakeSms implements SmsSender {
  sent: { to: string; body: string }[] = [];
  constructor(private opts: { fail?: boolean } = {}) {}
  async send(to: string, body: string): Promise<void> {
    if (this.opts.fail) throw new Error("sms failed");
    this.sent.push({ to, body });
  }
}

export function makeSmsFromEnv(): SmsSender {
  if (!process.env.SMS_API_KEY) throw new SmsNotConfigured();
  throw new SmsNotConfigured("no SMS vendor is implemented yet");
}

/** Like makeSmsFromEnv, but never throws: an unconfigured sender fails at send time, so the alert can record the failure and go on. */
export function smsFromEnvOrUnconfigured(): SmsSender {
  try {
    return makeSmsFromEnv();
  } catch (e) {
    return { send: async () => { throw e; } };
  }
}
