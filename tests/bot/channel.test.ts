// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { getChannel, SimulatorChannel } from "@/lib/bot/channel";
import { CloudApiChannel } from "@/lib/bot/cloudApi";

const KEYS = ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_CHANNEL", "VERCEL"];
afterEach(() => { for (const k of KEYS) delete process.env[k]; });

describe("getChannel", () => {
  it("uses the Cloud API when the credentials are set", () => {
    process.env.WHATSAPP_TOKEN = "t"; process.env.WHATSAPP_PHONE_NUMBER_ID = "1";
    expect(getChannel()).toBeInstanceOf(CloudApiChannel);
  });
  it("uses the simulator when it is asked for, even with credentials", () => {
    process.env.WHATSAPP_TOKEN = "t"; process.env.WHATSAPP_PHONE_NUMBER_ID = "1"; process.env.WHATSAPP_CHANNEL = "simulator";
    expect(getChannel()).toBeInstanceOf(SimulatorChannel);
  });
  it("uses the simulator on a developer machine with no credentials", () => {
    expect(getChannel()).toBeInstanceOf(SimulatorChannel);
  });
  it("on Vercel with no credentials, every send fails instead of pretending to send", async () => {
    process.env.VERCEL = "1";
    const ch = getChannel();
    expect(ch).not.toBeInstanceOf(SimulatorChannel);
    await expect(ch.send("972500000000", { type: "text", body: "x" })).rejects.toThrow(/not configured/);
    await expect(ch.fetchMedia("m")).rejects.toThrow(/not configured/);
  });
  it("on Vercel the simulator can still be forced, for a test deployment", () => {
    process.env.VERCEL = "1"; process.env.WHATSAPP_CHANNEL = "simulator";
    expect(getChannel()).toBeInstanceOf(SimulatorChannel);
  });
});
