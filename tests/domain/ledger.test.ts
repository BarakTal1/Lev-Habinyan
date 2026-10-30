import { describe, expect, it } from "vitest";
import { buildLedger, tariffCharges, type LedgerPayment } from "@/lib/domain/ledger";

const today = "2026-10-30";
const fees = tariffCharges([
  { unit_id: "u1", month: "2026-09-01", amount_agorot: 35000 },
  { unit_id: "u1", month: "2026-10-01", amount_agorot: 35000 },
  { unit_id: "u1", month: "2026-11-01", amount_agorot: 35000 },
]);
const pay = (amount: number, o: Partial<LedgerPayment> = {}): LedgerPayment => ({ unitId: "u1", amount, paidAt: "2026-10-05", month: null, ...o });

describe("tariffCharges", () => {
  it("makes one charge per month, due on the first day, labelled MM/YYYY", () => {
    expect(fees[0]).toEqual({ unitId: "u1", due: "2026-09-01", amount: 35000, label: "09/2026" });
  });
});

describe("buildLedger", () => {
  it("counts only charges that are due", () => {
    const u = buildLedger(fees, [], today).get("u1")!;
    expect(u.due).toBe(70000);
    expect(u.balance).toBe(70000);
    expect(u.monthsOwed).toBe(2);
    expect(u.oldestOpen).toBe("2026-09-01");
  });

  it("pays oldest first", () => {
    const u = buildLedger(fees, [pay(35000)], today).get("u1")!;
    expect(u.monthsOwed).toBe(1);
    expect(u.oldestOpen).toBe("2026-10-01");
    expect(u.balance).toBe(35000);
  });

  it("payment with a month pays that month", () => {
    const u = buildLedger(fees, [pay(35000, { month: "2026-10-01" })], today).get("u1")!;
    expect(u.monthsOwed).toBe(1);
    expect(u.oldestOpen).toBe("2026-09-01");
  });

  it("a partial payment leaves the month open", () => {
    const u = buildLedger(fees, [pay(20000)], today).get("u1")!;
    expect(u.monthsOwed).toBe(2);
    expect(u.oldestOpen).toBe("2026-09-01");
    expect(u.balance).toBe(50000);
  });

  it("overpayment is credit", () => {
    const u = buildLedger(fees, [pay(100000)], today).get("u1")!;
    expect(u.balance).toBe(-30000);
    expect(u.monthsOwed).toBe(0);
    expect(u.oldestOpen).toBeNull();
  });

  it("no tariff, no debt", () => {
    const u = buildLedger([], [pay(35000, { unitId: "u2" })], today).get("u2")!;
    expect(u.due).toBe(0);
    expect(u.paid).toBe(35000);
    expect(u.balance).toBe(-35000);
    expect(u.monthsOwed).toBe(0);
  });

  it("refund adds debt back", () => {
    const u = buildLedger(fees, [pay(35000), pay(-35000, { paidAt: "2026-10-06" })], today).get("u1")!;
    expect(u.paid).toBe(0);
    expect(u.monthsOwed).toBe(2);
  });

  it("lastPaidAt is the latest positive payment", () => {
    const u = buildLedger(fees, [pay(100, { paidAt: "2026-09-02" }), pay(200, { paidAt: "2026-10-03" }), pay(-100, { paidAt: "2026-10-20" })], today).get("u1")!;
    expect(u.lastPaidAt).toBe("2026-10-03");
  });

  it("a payment for a month not yet due waits for that month", () => {
    const u = buildLedger(fees, [pay(35000, { month: "2026-11-01" })], today).get("u1")!;
    expect(u.balance).toBe(35000);
    expect(u.monthsOwed).toBe(1);
    expect(u.oldestOpen).toBe("2026-09-01");
  });
});

describe("buildLedger: months owed follow the balance", () => {
  it("a refund of a month-tagged payment reopens the debt", () => {
    const u = buildLedger(fees, [pay(35000, { month: "2026-10-01" }), pay(-35000, { paidAt: "2026-10-07" })], today).get("u1")!;
    expect(u.balance).toBe(70000);
    expect(u.monthsOwed).toBe(2);
    expect(u.oldestOpen).toBe("2026-09-01");
  });
  it("a prepayment for a future month leaves no months owed when the balance is zero", () => {
    const u = buildLedger(fees, [pay(35000), pay(35000, { month: "2026-11-01" })], today).get("u1")!;
    expect(u.balance).toBe(0);
    expect(u.monthsOwed).toBe(0);
    expect(u.oldestOpen).toBeNull();
  });
});
