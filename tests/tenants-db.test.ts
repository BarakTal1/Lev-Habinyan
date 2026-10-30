// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, founderClient } from "./helpers/db";
import { addResident, getBuilding } from "@/lib/db/buildings";
import { loadLedger, setMonthlyFee } from "@/lib/db/ledger";
import { applyApartments, previewApartments, updatePerson, updateUnitDetails } from "@/lib/db/tenants";

const tag = `t-tenants-${Date.now()}`;
const today = "2026-10-30";
let db: SupabaseClient, admin: SupabaseClient, buildingId: string;

beforeAll(async () => {
  ({ db } = await founderClient());
  admin = adminClient();
  buildingId = (await admin.from("building").insert({ name: tag }).select("id").single()).data!.id;
});

afterAll(async () => {
  const { data: units } = await admin.from("unit").select("id").eq("building_id", buildingId);
  const ids = (units ?? []).map((u) => u.id);
  const { data: ups } = await admin.from("unit_person").select("person_id").in("unit_id", ids);
  const people = (ups ?? []).map((u) => u.person_id);
  await admin.from("unit").update({ primary_contact_id: null }).in("id", ids);
  await admin.from("tariff").delete().in("unit_id", ids);
  await admin.from("unit_person").delete().in("unit_id", ids);
  await admin.from("person").delete().in("id", people);
  await admin.from("unit").delete().in("id", ids);
  await admin.from("building").delete().eq("id", buildingId);
});

const apartment = async (n: string) => (await getBuilding(db, buildingId))!.apartments.find((a) => a.number === n)!;

describe("tenant details", () => {
  it("stores an email with a new resident and edits a person", async () => {
    const id = await addResident(db, { building_id: buildingId, unit_number: "1", name: "אורי", phone: "052-1111111", email: "uri@example.com", relation: "owner" });
    let r = (await getBuilding(db, buildingId))!.residents.find((x) => x.person_id === id)!;
    expect(r.email).toBe("uri@example.com");
    await updatePerson(db, id, { name: "אורי כהן", phone: "052-2222222", email: null });
    r = (await getBuilding(db, buildingId))!.residents.find((x) => x.person_id === id)!;
    expect(r).toMatchObject({ name: "אורי כהן", phone: "052-2222222", email: null });
  });

  it("sets floor, payer and primary contact of an apartment", async () => {
    const tenant = await addResident(db, { building_id: buildingId, unit_number: "1", name: "שוכרת", phone: "054-3333333", relation: "tenant" });
    const a = await apartment("1");
    await updateUnitDetails(db, a.id, { floor: "3", payer: "tenant", primaryContactId: tenant });
    expect(await apartment("1")).toMatchObject({ floor: "3", payer: "tenant", primary_contact_id: tenant });
  });

  it("the ledger shows the primary contact when two people share the paying role", async () => {
    const second = await addResident(db, { building_id: buildingId, unit_number: "1", name: "שוכר שני", phone: "054-4444444", relation: "tenant" });
    const a = await apartment("1");
    await setMonthlyFee(db, a.id, 35000, "2026-10-01", "2026-10-01");
    await updateUnitDetails(db, a.id, { primaryContactId: second });
    const row = (await loadLedger(db, { buildingId, today })).rows.find((r) => r.unitId === a.id)!;
    expect(row.payerName).toBe("שוכר שני");
  });

  it("imports the apartments file, then a second import changes nothing", async () => {
    const grid = [
      ["דירה", "קומה", "בעלים", "טלפון בעלים", "אימייל בעלים", "שוכר", "טלפון שוכר", "משלם", "דמי ועד"],
      ["1", "3", "אורי כהן", "052-2222222", "uri2@example.com", "", "", "", ""],
      ["7", "4", "מיכל", "050-5555555", "", "יוסי", "053-6666666", "שוכר", "400"],
    ];
    const p = await previewApartments(db, buildingId, grid);
    expect(p).toMatchObject({ unitsAdded: 1, unitsChanged: 0, peopleAdded: 2, peopleChanged: 1, fees: 1, problems: [] });
    await applyApartments(db, buildingId, grid, today);
    const seven = await apartment("7");
    expect(seven).toMatchObject({ floor: "4", payer: "tenant" });
    const b = (await getBuilding(db, buildingId))!;
    expect(b.residents.filter((r) => r.unit === "7").map((r) => r.name).sort()).toEqual(["יוסי", "מיכל"]);
    expect(b.residents.find((r) => r.name === "אורי כהן")!.email).toBe("uri2@example.com");
    const { data: fees } = await admin.from("tariff").select("month, amount_agorot").eq("unit_id", seven.id).order("month");
    expect(fees!.map((f) => f.month)).toEqual(["2026-10-01", "2026-11-01", "2026-12-01"]);
    expect(await previewApartments(db, buildingId, grid)).toMatchObject({ unitsAdded: 0, unitsChanged: 0, peopleAdded: 0, peopleChanged: 0 });
  });

  it("a phone match with a different name changes nothing and is reported", async () => {
    const grid = [["דירה", "בעלים", "טלפון בעלים"], ["1", "רחל", "052-2222222"]];
    const p = await previewApartments(db, buildingId, grid);
    expect(p).toMatchObject({ peopleAdded: 0, peopleChanged: 0 });
    expect(p.problems).toContainEqual({ row: 2, column: "בעלים", reason: "אותו טלפון כמו אורי כהן, שם אחר. לא עודכן" });
    await applyApartments(db, buildingId, grid, today);
    const names = (await getBuilding(db, buildingId))!.residents.map((r) => r.name);
    expect(names).toContain("אורי כהן");
    expect(names).not.toContain("רחל");
  });

  it("matches a phone written with 972 and a name with extra spaces", async () => {
    const p = await previewApartments(db, buildingId, [["דירה", "בעלים", "טלפון בעלים"], ["1", "אורי  כהן", "+972-52-2222222"]]);
    expect(p).toMatchObject({ peopleAdded: 0, peopleChanged: 0, problems: [] });
  });

  it("counts only fees that change, and writes nothing when the fee is the same", async () => {
    const same = await previewApartments(db, buildingId, [["דירה", "דמי ועד"], ["7", "400"]], today);
    expect(same.fees).toBe(0);
    const changed = await previewApartments(db, buildingId, [["דירה", "דמי ועד"], ["7", "450"]], today);
    expect(changed.fees).toBe(1);
  });

  it("reports a stored owner who is not in the file", async () => {
    const p = await previewApartments(db, buildingId, [["דירה", "בעלים", "טלפון בעלים"], ["7", "דנה", "050-7777777"]]);
    expect(p.problems).toContainEqual({ row: 2, column: "בעלים", reason: "הבעלים הרשומים (מיכל) לא בקובץ" });
  });

  it("an empty cell in the file never clears a stored value", async () => {
    await applyApartments(db, buildingId, [["דירה", "בעלים", "טלפון בעלים"], ["1", "אורי כהן", ""]], today);
    const b = (await getBuilding(db, buildingId))!;
    expect(b.residents.find((r) => r.name === "אורי כהן")!.phone).toBe("052-2222222");
    expect((await apartment("1")).floor).toBe("3");
  });
});
