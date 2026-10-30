// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "./helpers/db";
import { addNote, assign, createTicket, listTickets, setStatus, updateTicket, uploadAttachment, validatePatch } from "@/lib/db/tickets";

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

describe("listTickets closed tickets", () => {
  it("hides closed tickets by default and shows them when asked", async () => {
    const open = await make({ title: `${tag} פתוחה-רשימה` });
    const closed = await make({ title: `${tag} סגורה-רשימה` });
    await setStatus(db, profileId, closed.id, "בוצע");
    const def = (await listTickets(db, { building: buildingId }, founderPersonId)).map((r) => r.id);
    expect(def).toContain(open.id);
    expect(def).not.toContain(closed.id);
    const all = (await listTickets(db, { building: buildingId, closed: true }, founderPersonId)).map((r) => r.id);
    expect(all).toContain(closed.id);
  });
  it("an explicit status filter shows that status, closed or not", async () => {
    const closed = await make({ title: `${tag} סגורה-סינון` });
    await setStatus(db, profileId, closed.id, "בוצע");
    const rows = await listTickets(db, { building: buildingId, status: "בוצע" }, founderPersonId);
    expect(rows.map((r) => r.id)).toContain(closed.id);
  });
});

describe("updateTicket", () => {
  it("changes the editable fields and writes an edit event", async () => {
    const r = await make();
    await updateTicket(db, profileId, r.id, { title: `${tag} חדש`, urgency: "דחוף", due_at: "2026-12-01", scheduled_at: "2026-12-02T09:30:00+02:00" });
    const t = (await admin.from("ticket").select("title, urgency, due_at, scheduled_at").eq("id", r.id).single()).data!;
    expect(t).toMatchObject({ title: `${tag} חדש`, urgency: "דחוף", due_at: "2026-12-01" });
    expect(new Date(t.scheduled_at).toISOString()).toBe("2026-12-02T07:30:00.000Z");
    const { count } = await admin.from("ticket_event").select("*", { count: "exact", head: true }).eq("ticket_id", r.id).eq("type", "edit");
    expect(count).toBe(1);
  });
  it("ignores fields that are not editable, such as status and created_by", async () => {
    const r = await make();
    await updateTicket(db, profileId, r.id, { status: "בוצע", created_by: "x" } as never);
    const t = (await admin.from("ticket").select("status, created_by").eq("id", r.id).single()).data!;
    expect(t).toEqual({ status: "חדש", created_by: profileId });
  });
});

describe("validatePatch", () => {
  it("accepts a good patch", () => expect(() => validatePatch({ title: "x", urgency: "סכנה", category: "חשמל" })).not.toThrow());
  it("rejects an empty title", () => expect(() => validatePatch({ title: "  " })).toThrow());
  it("rejects an urgency that is not on the list", () => expect(() => validatePatch({ urgency: "דחוף מאוד" })).toThrow());
  it("rejects a category that is not on the list", () => expect(() => validatePatch({ category: "בלגן" })).toThrow());
  it("rejects a bad date", () => expect(() => validatePatch({ due_at: "32.13.2026" })).toThrow());
});

describe("createTicket with a unit number", () => {
  it("creates the unit when it does not exist and links the ticket to it", async () => {
    const r = await make({ unit_number: "12" });
    const t = (await admin.from("ticket").select("unit_id").eq("id", r.id).single()).data!;
    const u = (await admin.from("unit").select("number, building_id").eq("id", t.unit_id).single()).data!;
    expect(u).toEqual({ number: "12", building_id: buildingId });
    const r2 = await make({ unit_number: "12" });
    const t2 = (await admin.from("ticket").select("unit_id").eq("id", r2.id).single()).data!;
    expect(t2.unit_id).toBe(t.unit_id);
  });
});

describe("concurrent status and assignment", () => {
  it("both changes land and the timeline has both events", async () => {
    const r = await make();
    await Promise.all([setStatus(db, profileId, r.id, "בטיפול"), assign(db2, profile2, r.id, founderPersonId)]);
    const t = (await admin.from("ticket").select("assignee_id").eq("id", r.id).single()).data!;
    expect(t.assignee_id).toBe(founderPersonId);
    const { data: ev } = await admin.from("ticket_event").select("type").eq("ticket_id", r.id);
    expect(ev!.map((e) => e.type)).toEqual(expect.arrayContaining(["status", "assignment"]));
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

describe("ticket list rows from WhatsApp", () => {
  it("say whether the resident is approved", async () => {
    const mk = async (approved: boolean) => {
      const { data } = await admin.from("ticket").insert({ kind: "fault", category: "חשמל", title: `${tag} אישור ${approved}`, building_id: buildingId, resident_approved: approved }).select("id").single();
      ticketIds.push(data!.id);
      return data!.id as string;
    };
    const yes = await mk(true), no = await mk(false);
    const rows = await listTickets(db, { building: buildingId }, null);
    expect(rows.find((r) => r.id === yes)!.resident_approved).toBe(true);
    expect(rows.find((r) => r.id === no)!.resident_approved).toBe(false);
  });
});
