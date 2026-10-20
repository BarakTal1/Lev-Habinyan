// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/cron/reminders/route";

const req = (auth?: string) => new Request("http://x/api/cron/reminders", { headers: auth ? { authorization: auth } : {} });
afterEach(() => { delete process.env.CRON_SECRET; });

describe("cron reminders route", () => {
  it("rejects a request with no secret configured", async () => {
    expect((await GET(req("Bearer anything"))).status).toBe(401);
  });
  it("rejects a wrong secret", async () => {
    process.env.CRON_SECRET = "right";
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
  });
  it("rejects a missing header", async () => {
    process.env.CRON_SECRET = "right";
    expect((await GET(req())).status).toBe(401);
  });
});
