import { describe, expect, it } from "vitest";
import { parseApartmentsSheet } from "@/lib/import/apartmentsSheet";

const header = ["דירה", "קומה", "בעלים", "טלפון בעלים", "אימייל בעלים", "שוכר", "טלפון שוכר", "אימייל שוכר", "משלם", "דמי ועד"];

describe("parseApartmentsSheet", () => {
  it("reads an apartment with an owner and a tenant", () => {
    const r = parseApartmentsSheet([header, ["03", "2", "רונית כהן", "052-1234567", "ronit@example.com", "דני לוי", "054-7654321", "", "שוכר", "350"]]);
    expect(r.problems).toEqual([]);
    expect(r.rows).toEqual([{
      row: 2, unit: "3", floor: "2",
      owner: { name: "רונית כהן", phone: "052-1234567", email: "ronit@example.com" },
      tenant: { name: "דני לוי", phone: "054-7654321", email: null },
      payer: "tenant", fee: 35000,
    }]);
  });

  it("allows an apartment with an owner only and no optional columns", () => {
    const r = parseApartmentsSheet([["דירה", "בעלים", "טלפון בעלים"], ["1", "משה", "0521234567"]]);
    expect(r.rows[0]).toMatchObject({ unit: "1", floor: null, tenant: null, payer: null, fee: null, owner: { name: "משה", phone: "0521234567", email: null } });
    expect(r.problems).toEqual([]);
  });

  it("flags an apartment with no phone but still reads it", () => {
    const r = parseApartmentsSheet([["דירה", "בעלים"], ["4", "משה"]]);
    expect(r.rows).toHaveLength(1);
    expect(r.problems).toEqual([{ row: 2, column: "טלפון", reason: "אין טלפון לדירה" }]);
  });

  it("reports a bad phone, a bad email, a bad fee and a bad payer value", () => {
    const r = parseApartmentsSheet([header, ["5", "", "משה", "12", "not-an-email", "", "", "", "אחר", "abc"]]);
    expect(r.problems.map((p) => p.column)).toEqual(["טלפון בעלים", "אימייל בעלים", "משלם", "דמי ועד"]);
  });

  it("reports a missing apartment column and a row without a number", () => {
    expect(parseApartmentsSheet([["בעלים"], ["משה"]]).problems).toEqual([{ row: 1, column: "דירה", reason: "חסרה עמודה" }]);
    expect(parseApartmentsSheet([["דירה", "בעלים"], ["", "משה"]]).problems).toEqual([{ row: 2, column: "דירה", reason: "חסר מספר דירה" }]);
  });
});
