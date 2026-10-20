// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "./helpers/db";
import { addResident, archiveResident, createBuilding, getBuilding, listBuildingCards } from "@/lib/db/buildings";

const tag = `t7-${Date.now()}`;
let db: SupabaseClient, admin: SupabaseClient, profileId: string;
const buildingIds: string[] = [];

beforeAll(async () => {
  ({ db, profileId } = await founderClient());
  admin = adminClient();
});

afterAll(async () => {
  for (const id of buildingIds) {
    const { data: units } = await admin.from("unit").select("id").eq("building_id", id);
    const unitIds = (units ?? []).map((u) => u.id);
    const { data: ups } = await admin.from("unit_person").select("person_id").in("unit_id", unitIds);
    await admin.from("unit_person").delete().in("unit_id", unitIds);
    await admin.from("person").delete().in("id", (ups ?? []).map((u) => u.person_id));
    await admin.from("attachment").delete().eq("building_id", id);
    await admin.from("unit").delete().eq("building_id", id);
    await admin.from("maintenance_item").delete().eq("building_id", id);
    await admin.from("building").delete().eq("id", id);
  }
});

const newBuilding = async () => {
  const id = await createBuilding(db, { name: `${tag} בניין`, city: "תל אביב" });
  buildingIds.push(id);
  return id;
};

describe("addResident", () => {
  it("creates the unit when it does not exist and reuses it when it does", async () => {
    const b = await newBuilding();
    await addResident(db, { building_id: b, unit_number: "7", name: `${tag} א`, phone: "052-0000999", relation: "owner" });
    await addResident(db, { building_id: b, unit_number: "7", name: `${tag} ב`, phone: "052-0000998", relation: "tenant" });
    const { data } = await admin.from("unit").select("id").eq("building_id", b);
    expect(data).toHaveLength(1);
    const detail = await getBuilding(db, b);
    expect(detail!.residents.map((r) => r.name).sort()).toEqual([`${tag} א`, `${tag} ב`]);
  });

  it("does not list an archived resident", async () => {
    const b = await newBuilding();
    const personId = await addResident(db, { building_id: b, unit_number: "1", name: `${tag} ארכיון`, phone: "052-0000997", relation: "tenant" });
    await archiveResident(db, personId);
    const detail = await getBuilding(db, b);
    expect(detail!.residents).toHaveLength(0);
  });

  it("marks committee members", async () => {
    const b = await newBuilding();
    await addResident(db, { building_id: b, unit_number: "2", name: `${tag} ועד`, phone: "052-0000996", relation: "owner", is_committee: true });
    const detail = await getBuilding(db, b);
    expect(detail!.residents[0].is_committee).toBe(true);
  });
});

describe("listBuildingCards", () => {
  it("counts units and open tickets, and shows the worst maintenance state", async () => {
    const b = await newBuilding();
    await addResident(db, { building_id: b, unit_number: "1", name: `${tag} ג`, phone: "052-0000995", relation: "owner" });
    const ins = await admin.from("ticket").insert([
      { kind: "fault", building_id: b, category: "חשמל", title: `${tag} פתוחה`, status: "חדש" },
      { kind: "fault", building_id: b, category: "חשמל", title: `${tag} סגורה`, status: "בוצע" },
    ]);
    expect(ins.error).toBeNull();
    await admin.from("maintenance_item").insert({ building_id: b, system: "בדיקת גג", last_done_at: "2020-01-01", next_due_at: "2020-06-01" });
    const cards = await listBuildingCards(db);
    const card = cards.find((c) => c.id === b)!;
    expect(card.units).toBe(1);
    expect(card.open_tickets).toBe(1);
    expect(card.worst).toBe("overdue");
    expect(card.worst_count).toBe(1);
    await admin.from("ticket").delete().eq("building_id", b);
  });

  it("does not list an archived building", async () => {
    const b = await newBuilding();
    await admin.from("building").update({ archived_at: new Date().toISOString() }).eq("id", b);
    expect((await listBuildingCards(db)).map((c) => c.id)).not.toContain(b);
  });
});
