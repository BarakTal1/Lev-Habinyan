// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "../helpers/db";
import { getTicket, updateTicket, validatePatch } from "@/lib/db/tickets";

const tag = `t-corr-${Date.now()}`;
let db: SupabaseClient, admin: SupabaseClient, profileId: string;
const tickets: string[] = [];

beforeAll(async () => {
  ({ db, profileId } = await founderClient());
  admin = adminClient();
});
afterAll(async () => {
  await admin.from("proposal_log").delete().in("ticket_id", tickets);
  await admin.from("ticket_event").delete().in("ticket_id", tickets);
  await admin.from("ticket").delete().in("id", tickets);
});

/** A ticket, with the proposal the rules made when it came from WhatsApp. */
async function make(source: "whatsapp" | "dispatcher", withProposal = source === "whatsapp") {
  const t = (await admin.from("ticket").insert({ kind: "fault", category: "חשמל", title: `${tag} ${source}`, urgency: "חשוב", source }).select("id").single()).data!;
  tickets.push(t.id);
  if (withProposal) await admin.from("proposal_log").insert({ ticket_id: t.id, proposed: { title: `${tag} ${source}`, urgency: "חשוב", responsibility: "לא ידוע" } });
  return t.id as string;
}
const correction = async (id: string) => (await admin.from("proposal_log").select("roy_correction").eq("ticket_id", id).single()).data!.roy_correction;

describe("Roy's corrections of a WhatsApp ticket", () => {
  it("records the old and new value of a changed urgency", async () => {
    const id = await make("whatsapp");
    await updateTicket(db, profileId, id, { urgency: "דחוף" });
    expect(await correction(id)).toEqual({ urgency: { from: "חשוב", to: "דחוף" } });
  });

  it("keeps the proposed value as 'from' across several edits, and adds other fields", async () => {
    const id = await make("whatsapp");
    await updateTicket(db, profileId, id, { urgency: "דחוף" });
    await updateTicket(db, profileId, id, { urgency: "סכנה", responsibility: "הוועד", category: "אינסטלציה" });
    expect(await correction(id)).toEqual({
      urgency: { from: "חשוב", to: "סכנה" }, responsibility: { from: "לא ידוע", to: "הוועד" }, category: { from: "חשמל", to: "אינסטלציה" },
    });
  });

  it("removes a correction when the founder puts the proposed value back", async () => {
    const id = await make("whatsapp");
    await updateTicket(db, profileId, id, { urgency: "דחוף" });
    await updateTicket(db, profileId, id, { urgency: "חשוב" });
    expect(await correction(id)).toBeNull();
  });

  it("records nothing for an edit of another field, or of the same value", async () => {
    const id = await make("whatsapp");
    await updateTicket(db, profileId, id, { title: `${tag} חדש`, description: "תיאור" });
    await updateTicket(db, profileId, id, { urgency: "חשוב" });
    expect(await correction(id)).toBeNull();
  });

  it("records nothing for a ticket a founder made", async () => {
    const id = await make("dispatcher", true);
    await updateTicket(db, profileId, id, { urgency: "דחוף" });
    expect(await correction(id)).toBeNull();
  });

  it("does not fail when a WhatsApp ticket has no proposal row", async () => {
    const id = await make("whatsapp", false);
    await expect(updateTicket(db, profileId, id, { urgency: "דחוף" })).resolves.toBeUndefined();
  });
});

describe("responsibility", () => {
  it("can be edited, and a value outside the list is refused", async () => {
    const id = await make("dispatcher");
    await updateTicket(db, profileId, id, { responsibility: "אחריות ספק" });
    expect((await getTicket(db, id))!.responsibility).toBe("אחריות ספק");
    expect(() => validatePatch({ responsibility: "מישהו" })).toThrow("bad responsibility");
  });

  it("shows the proposal of the rules on the ticket", async () => {
    const id = await make("whatsapp");
    expect((await getTicket(db, id))!.proposal).toMatchObject({ urgency: "חשוב", responsibility: "לא ידוע" });
    expect((await getTicket(db, await make("dispatcher", false)))!.proposal).toBeNull();
  });
});
