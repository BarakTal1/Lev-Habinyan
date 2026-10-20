import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// A plain function behind the mock, so a failing save is an ordinary rejection (not a recorded mock throw).
let impl: () => Promise<{ needsFrequency: boolean }> = async () => ({ needsFrequency: false });
vi.mock("@/app/(app)/actions", () => ({ completeRowAction: () => impl() }));

import { TodaySection, type SectionRow } from "@/components/TodaySection";

const rows: SectionRow[] = [
  { id: "m1", kind: "maintenance", title: "בדיקת גג", building: "ויצמן 9", meta: "יום איחור", late: true, badge: { list: "maint", value: "באיחור" } },
];

beforeEach(() => { impl = async () => ({ needsFrequency: false }); });

describe("TodaySection check-off", () => {
  it("hides the row at once and asks for a frequency when the item has none", async () => {
    impl = async () => ({ needsFrequency: true });
    render(<TodaySection title="באיחור" rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: /סימון כבוצע/ }));
    expect(screen.queryByText("בדיקת גג")).toBeNull();
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("הגדירו תדירות"));
  });

  it("brings the row back and shows an error when the save fails", async () => {
    impl = async () => { throw new Error("save failed"); };
    render(<TodaySection title="באיחור" rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: /סימון כבוצע/ }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("השמירה נכשלה"));
    expect(screen.getByText("בדיקת גג")).toBeInTheDocument();
  });

  it("shows no notice and no row after a normal check-off", async () => {
    render(<TodaySection title="באיחור" rows={rows} />);
    fireEvent.click(screen.getByRole("button", { name: /סימון כבוצע/ }));
    await waitFor(() => expect(screen.queryByText("בדיקת גג")).toBeNull());
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
