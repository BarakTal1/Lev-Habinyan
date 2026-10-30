import { describe, expect, it } from "vitest";
import { debtorsCsv } from "@/lib/domain/ledger";

const row = { buildingName: "הירקון 112", unit: "3", payerName: 'כהן, "דני"', payerPhone: "052-0000101", balance: 35000, monthsOwed: 1, oldestOpen: "2026-10-01", lastPaidAt: null };

describe("debtorsCsv", () => {
  it("starts with a byte order mark and a Hebrew header line", () => {
    const lines = debtorsCsv([row]).split("\n");
    expect(lines[0].startsWith("﻿")).toBe(true);
    expect(lines[0].slice(1)).toBe("בניין,דירה,משלם,טלפון,יתרה (₪),חודשים בחוב,חוב מחודש,תשלום אחרון");
  });
  it("writes the balance in shekels with two decimals and quotes text with commas or quotes", () => {
    const line = debtorsCsv([row]).split("\n")[1];
    expect(line).toBe('הירקון 112,3,"כהן, ""דני""",052-0000101,350.00,1,10/2026,');
  });
});
