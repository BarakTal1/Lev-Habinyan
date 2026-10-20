// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "./helpers/db";
import { archivePerson, getSetting, listAssignees, listEmployees, listSuppliers, saveEmployee, saveSupplier, setSetting } from "@/lib/db/people";

const tag = `t9-${Date.now()}`;
let db: SupabaseClient, admin: SupabaseClient;

beforeAll(async () => {
  ({ db } = await founderClient());
  admin = adminClient();
});

afterAll(async () => {
  const { data } = await admin.from("person").select("id").like("name", `${tag}%`);
  const ids = (data ?? []).map((p) => p.id);
  await admin.from("supplier_profile").delete().in("person_id", ids);
  await admin.from("employee_profile").delete().in("person_id", ids);
  await admin.from("person").delete().in("id", ids);
  await admin.from("setting").delete().eq("key", `${tag}-key`);
});

const supplier = (o: Record<string, unknown> = {}) => ({
  name: `${tag} ספק`, phone: "052-0000777", category: "חשמל", tier: "קבוע" as const, has_sla: true, availability: "24/7", area: "תל אביב", ...o,
});

describe("saveSupplier", () => {
  it("writes the person and the supplier profile", async () => {
    const id = await saveSupplier(db, supplier());
    const { data: p } = await admin.from("person").select("name, role, phone").eq("id", id).single();
    expect(p).toEqual({ name: `${tag} ספק`, role: "supplier", phone: "052-0000777" });
    const { data: sp } = await admin.from("supplier_profile").select("category, tier, has_sla").eq("person_id", id).single();
    expect(sp).toEqual({ category: "חשמל", tier: "קבוע", has_sla: true });
  });

  it("updates an existing supplier instead of creating a second one", async () => {
    const id = await saveSupplier(db, supplier({ name: `${tag} עדכון` }));
    await saveSupplier(db, supplier({ id, name: `${tag} עדכון`, tier: "חירום" }));
    const { data } = await admin.from("supplier_profile").select("tier").eq("person_id", id);
    expect(data).toEqual([{ tier: "חירום" }]);
  });

  it("rejects a tier that is not on the list", async () => {
    await expect(saveSupplier(db, supplier({ name: `${tag} רע`, tier: "אחר" as never }))).rejects.toThrow();
  });

  it("groups suppliers by category", async () => {
    await saveSupplier(db, supplier({ name: `${tag} קבוצה`, category: "גינון" }));
    const groups = await listSuppliers(db);
    const g = groups.find((x) => x.category === "גינון")!;
    expect(g.items.map((i) => i.name)).toContain(`${tag} קבוצה`);
  });
});

describe("archivePerson", () => {
  it("removes an archived supplier from the assignee picker", async () => {
    const id = await saveSupplier(db, supplier({ name: `${tag} לארכיון` }));
    expect((await listAssignees(db)).map((p) => p.id)).toContain(id);
    await archivePerson(db, id);
    expect((await listAssignees(db)).map((p) => p.id)).not.toContain(id);
  });
});

describe("saveEmployee", () => {
  it("writes the employee and lists it", async () => {
    const id = await saveEmployee(db, { name: `${tag} עובד`, phone: "050-0000888", job_role: "אב בית", area: "הרצליה" });
    const rows = await listEmployees(db);
    expect(rows.find((r) => r.id === id)).toMatchObject({ name: `${tag} עובד`, job_role: "אב בית", area: "הרצליה" });
  });
});

describe("settings", () => {
  it("stores and reads a value, with a default when missing", async () => {
    expect(await getSetting(db, `${tag}-key`, false)).toBe(false);
    await setSetting(db, `${tag}-key`, true);
    expect(await getSetting(db, `${tag}-key`, false)).toBe(true);
    await setSetting(db, `${tag}-key`, false);
    expect(await getSetting(db, `${tag}-key`, true)).toBe(false);
  });
});
