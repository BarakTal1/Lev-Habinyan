// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "./helpers/db";
import { archiveBuilding, createBuilding, getBuilding, listBuildingCards, updateBuilding } from "@/lib/db/buildings";
import { archiveTicket, createTicket, getTicket, listTickets, setStatus } from "@/lib/db/tickets";

const tag = `arch-${Date.now()}`;
let db: SupabaseClient, admin: SupabaseClient, profileId: string;
const buildingIds: string[] = [];
const ticketIds: string[] = [];

beforeAll(async () => {
  ({ db, profileId } = await founderClient());
  admin = adminClient();
});

afterAll(async () => {
  await admin.from("ticket_event").delete().in("ticket_id", ticketIds);
  await admin.from("ticket").delete().in("id", ticketIds);
  await admin.from("building").delete().in("id", buildingIds);
});

const newBuilding = async () => {
  const id = await createBuilding(db, { name: `${tag} בניין` });
  buildingIds.push(id);
  return id;
};

describe("updateBuilding", () => {
  it("changes the name, city, address and notes", async () => {
    const id = await newBuilding();
    await updateBuilding(db, id, { name: `${tag} חדש`, city: "חיפה", address: "הרצל 1", notes: "קוד שער 1234" });
    const b = await getBuilding(db, id);
    expect(b).toMatchObject({ name: `${tag} חדש`, city: "חיפה", address: "הרצל 1", notes: "קוד שער 1234" });
  });

  it("rejects an empty name", async () => {
    const id = await newBuilding();
    await expect(updateBuilding(db, id, { name: "   " })).rejects.toThrow(/name/);
  });

  it("trims the name", async () => {
    const id = await newBuilding();
    await updateBuilding(db, id, { name: `  ${tag} רווחים  ` });
    expect((await getBuilding(db, id))!.name).toBe(`${tag} רווחים`);
  });
});

describe("archiveBuilding", () => {
  it("hides a building that has no open tickets", async () => {
    const id = await newBuilding();
    await archiveBuilding(db, id);
    expect(await getBuilding(db, id)).toBeNull();
    expect((await listBuildingCards(db)).some((c) => c.id === id)).toBe(false);
    const { data } = await admin.from("building").select("archived_at").eq("id", id).single();
    expect(data!.archived_at).not.toBeNull();
  });

  it("refuses a building that has an open ticket", async () => {
    const id = await newBuilding();
    const t = await createTicket(db, profileId, { kind: "fault", title: `${tag} פתוח`, category: "אחר", building_id: id });
    ticketIds.push(t.id);
    await expect(archiveBuilding(db, id)).rejects.toThrow(/open/);
    expect(await getBuilding(db, id)).not.toBeNull();
  });

  it("allows a building whose tickets are all closed", async () => {
    const id = await newBuilding();
    const t = await createTicket(db, profileId, { kind: "fault", title: `${tag} סגור`, category: "אחר", building_id: id });
    ticketIds.push(t.id);
    await setStatus(db, profileId, t.id, "בוצע");
    await archiveBuilding(db, id);
    expect(await getBuilding(db, id)).toBeNull();
  });
});

describe("archiveTicket", () => {
  it("removes the ticket from the list and records who archived it", async () => {
    const t = await createTicket(db, profileId, { kind: "task", title: `${tag} לארכוב`, category: "אחר" });
    ticketIds.push(t.id);
    await archiveTicket(db, profileId, t.id);
    expect((await listTickets(db, { q: `${tag} לארכוב`, closed: true }, null)).some((r) => r.id === t.id)).toBe(false);
    const { data } = await admin.from("ticket_event").select("type, payload, actor").eq("ticket_id", t.id).eq("type", "edit");
    expect(data).toHaveLength(1);
    expect(data![0].actor).toBe(profileId);
    expect(Object.keys(data![0].payload)).toEqual(["archived_at"]);
  });

  it("is safe to repeat", async () => {
    const t = await createTicket(db, profileId, { kind: "task", title: `${tag} פעמיים`, category: "אחר" });
    ticketIds.push(t.id);
    await archiveTicket(db, profileId, t.id);
    await archiveTicket(db, profileId, t.id);
    const { data } = await admin.from("ticket_event").select("id").eq("ticket_id", t.id).eq("type", "edit");
    expect(data).toHaveLength(1);
  });

  it("getTicket no longer opens an archived ticket", async () => {
    const t = await createTicket(db, profileId, { kind: "task", title: `${tag} נעלם`, category: "אחר" });
    ticketIds.push(t.id);
    await archiveTicket(db, profileId, t.id);
    expect(await getTicket(db, t.id)).toBeNull();
  });
});
