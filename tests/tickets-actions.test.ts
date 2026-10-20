// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "./helpers/db";
import { addNote, assign, createTicket, listTickets, setStatus, uploadAttachment } from "@/lib/db/tickets";

const tag = `t6-${Date.now()}`;
let db: SupabaseClient, admin: SupabaseClient, profileId: string, buildingId: string, founderPersonId: string;
const ticketIds: string[] = [];
let db2: SupabaseClient, profile2: string, user2Id: string;

beforeAll(async () => {
  ({ db, profileId } = await founderClient());
  admin = adminClient();
  const { data: b } = await admin.from("building").insert({ name: `${tag} בניין` }).select("id").single();
  buildingId = b!.id;
  const { data: p } = await admin.from("profile").select("person_id").eq("id", profileId).single();
  founderPersonId = p!.person_id;

  // A second founder session, to test two people editing at once.
  const email = `${tag}@lev.local`;
  const created = await admin.auth.admin.createUser({ email, password: "second-founder-local", email_confirm: true });
  user2Id = created.data.user!.id;
  const { data: person } = await admin.from("person").insert({ name: `${tag} עומר`, role: "founder" }).select("id").single();
  const { data: prof } = await admin.from("profile").insert({ email, person_id: person!.id }).select("id").single();
  profile2 = prof!.id;
  db2 = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321", process.env.TEST_SUPABASE_ANON_KEY ?? (await anonKey()), { auth: { persistSession: false } });
  const { error } = await db2.auth.signInWithPassword({ email, password: "second-founder-local" });
  if (error) throw error;
});

async function anonKey() {
  return (await import("./helpers/db")).ANON_KEY;
}

afterAll(async () => {
  await admin.from("attachment").delete().in("ticket_id", ticketIds);
  await admin.from("ticket_event").delete().in("ticket_id", ticketIds);
  await admin.from("ticket").delete().in("id", ticketIds);
  await admin.from("building").delete().eq("id", buildingId);
  await admin.from("profile").delete().eq("id", profile2);
  await admin.from("person").delete().like("name", `${tag}%`);
  await admin.auth.admin.deleteUser(user2Id);
  const { data: files } = await admin.storage.from("attachments").list(`tickets`);
  void files;
});

const make = async (o: Record<string, unknown> = {}) => {
  const r = await createTicket(db, profileId, { kind: "fault", building_id: buildingId, title: `${tag} תקלה`, category: "חשמל", ...o } as never);
  ticketIds.push(r.id);
  return r;
};

describe("createTicket", () => {
  it("returns an increasing number and writes a created event", async () => {
    const a = await make();
    const b = await make();
    expect(b.number).toBeGreaterThan(a.number);
    const { data } = await admin.from("ticket_event").select("type, actor").eq("ticket_id", a.id);
    expect(data).toEqual([{ type: "created", actor: profileId }]);
  });
  it("accepts a company-wide task with no building", async () => {
    const r = await make({ kind: "task", building_id: null, title: `${tag} חשבונאי` });
    const { data } = await admin.from("ticket").select("building_id, kind, urgency, status").eq("id", r.id).single();
    expect(data).toEqual({ building_id: null, kind: "task", urgency: "חשוב", status: "חדש" });
  });
  it("keeps the original WhatsApp message", async () => {
    const r = await make({ original_message: "שלום, יש נזילה בקומה 3" });
    const { data } = await admin.from("ticket").select("original_message").eq("id", r.id).single();
    expect(data!.original_message).toBe("שלום, יש נזילה בקומה 3");
  });
});

describe("status and assignment", () => {
  it("sets first_action_at only on the first status change", async () => {
    const r = await make();
    await setStatus(db, profileId, r.id, "בטיפול");
    const first = (await admin.from("ticket").select("first_action_at").eq("id", r.id).single()).data!.first_action_at;
    expect(first).not.toBeNull();
    await setStatus(db, profileId, r.id, "ממתין");
    const second = (await admin.from("ticket").select("first_action_at").eq("id", r.id).single()).data!.first_action_at;
    expect(second).toBe(first);
  });
  it("closing sets closed_at and reopening clears it", async () => {
    const r = await make();
    await setStatus(db, profileId, r.id, "בוצע");
    expect((await admin.from("ticket").select("closed_at").eq("id", r.id).single()).data!.closed_at).not.toBeNull();
    await setStatus(db, profileId, r.id, "נפתח מחדש");
    expect((await admin.from("ticket").select("closed_at").eq("id", r.id).single()).data!.closed_at).toBeNull();
  });
  it("assigning a new ticket moves it to הוקצה and writes an assignment event", async () => {
    const r = await make();
    await assign(db, profileId, r.id, founderPersonId);
    const t = (await admin.from("ticket").select("status, assignee_id").eq("id", r.id).single()).data!;
    expect(t).toEqual({ status: "הוקצה", assignee_id: founderPersonId });
    const { count } = await admin.from("ticket_event").select("*", { count: "exact", head: true }).eq("ticket_id", r.id).eq("type", "assignment");
    expect(count).toBe(1);
  });
});

describe("two founders at once", () => {
  it("both notes appear in the timeline with different actors and no error", async () => {
    const r = await make();
    await Promise.all([addNote(db, profileId, r.id, "הערה ראשונה"), addNote(db2, profile2, r.id, "הערה שנייה")]);
    const { data } = await admin.from("ticket_event").select("actor, payload").eq("ticket_id", r.id).eq("type", "note");
    expect(data).toHaveLength(2);
    expect(new Set(data!.map((e) => e.actor))).toEqual(new Set([profileId, profile2]));
  });
});

describe("listTickets", () => {
  it("filters by kind and building", async () => {
    await make({ kind: "task", title: `${tag} משימה` });
    const rows = await listTickets(db, { building: buildingId, kind: "task" }, founderPersonId);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.kind === "task" && r.building_id === buildingId)).toBe(true);
  });
  it("mine=1 returns only tickets assigned to the caller", async () => {
    const mine = await make({ title: `${tag} שלי` });
    await assign(db, profileId, mine.id, founderPersonId);
    await make({ title: `${tag} לא שלי` });
    const rows = await listTickets(db, { building: buildingId, mine: true }, founderPersonId);
    expect(rows.map((r) => r.id)).toContain(mine.id);
    expect(rows.every((r) => r.assignee_id === founderPersonId)).toBe(true);
  });
  it("search matches the title and excludes archived tickets", async () => {
    const r = await make({ title: `${tag} ייחודי-חיפוש` });
    await admin.from("ticket").update({ archived_at: new Date().toISOString() }).eq("id", r.id);
    const rows = await listTickets(db, { q: "ייחודי-חיפוש" }, founderPersonId);
    expect(rows.map((x) => x.id)).not.toContain(r.id);
  });
});

describe("uploadAttachment", () => {
  it("stores the file and writes an attachment row and a photo event", async () => {
    const r = await make();
    const file = new File([new Uint8Array([1, 2, 3])], "x.png", { type: "image/png" });
    await uploadAttachment(db, profileId, r.id, "photo", file);
    const { data } = await admin.from("attachment").select("kind, storage_path, mime_type").eq("ticket_id", r.id);
    expect(data).toHaveLength(1);
    expect(data![0].kind).toBe("photo");
    const dl = await admin.storage.from("attachments").download(data![0].storage_path);
    expect(dl.error).toBeNull();
    await admin.storage.from("attachments").remove([data![0].storage_path]);
  });
});
