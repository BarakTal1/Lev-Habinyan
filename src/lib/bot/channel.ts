import type { Out } from "./types";
import { CloudApiChannel } from "./cloudApi";

export interface Channel {
  send(phone: string, out: Out): Promise<{ waMessageId: string | null }>;
  fetchMedia(mediaId: string): Promise<{ bytes: Uint8Array; mime: string }>;
}

export class SimulatorChannel implements Channel {
  sent: { phone: string; out: Out }[] = [];
  media = new Map<string, { bytes: Uint8Array; mime: string }>();

  async send(phone: string, out: Out): Promise<{ waMessageId: string | null }> {
    this.sent.push({ phone, out });
    return { waMessageId: null };
  }

  async fetchMedia(mediaId: string): Promise<{ bytes: Uint8Array; mime: string }> {
    const m = this.media.get(mediaId);
    if (!m) throw new Error(`media not found: ${mediaId}`);
    return m;
  }
}

/** The channel on a deployment that has no WhatsApp credentials yet. Every send fails, so a founder never sees "sent" for a message that never left. */
export class UnconfiguredChannel implements Channel {
  async send(): Promise<{ waMessageId: string | null }> { throw new Error("WhatsApp is not configured"); }
  async fetchMedia(): Promise<{ bytes: Uint8Array; mime: string }> { throw new Error("WhatsApp is not configured"); }
}

let simulator: SimulatorChannel | null = null;

// Returns the Cloud API channel when the credentials exist, unless the simulator is forced.
export function getChannel(): Channel {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (token && phoneNumberId && process.env.WHATSAPP_CHANNEL !== "simulator") {
    return new CloudApiChannel({ token, phoneNumberId });
  }
  // No credentials: the simulator on a developer machine (or when it is forced), a failing channel on Vercel.
  if (process.env.WHATSAPP_CHANNEL === "simulator" || !process.env.VERCEL) return (simulator ??= new SimulatorChannel());
  return new UnconfiguredChannel();
}
