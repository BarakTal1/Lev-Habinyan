import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PendingResident } from "@/lib/db/inbox";
import { t } from "@/lib/labels";

const approveResidentAction = vi.fn<(...a: unknown[]) => Promise<void>>(async () => {});
const rejectResidentAction = vi.fn<(...a: unknown[]) => Promise<void>>(async () => {});
vi.mock("@/app/(app)/inbox/actions", () => ({
  approveResidentAction: (...a: unknown[]) => approveResidentAction(...a),
  rejectResidentAction: (...a: unknown[]) => rejectResidentAction(...a),
}));

import { PendingResidentsCard } from "@/components/PendingResidentsCard";

const resident = (over: Partial<PendingResident> = {}): PendingResident => ({
  personId: "p1", name: "דנה כהן", phone: "0521234567", buildingName: "הירקון 112", unitId: "u1", unitNumber: "7", relation: "tenant",
  ticketNumbers: [12, 15], unitHasOtherResident: false, ...over,
});

beforeEach(() => { approveResidentAction.mockClear(); rejectResidentAction.mockClear(); });
afterEach(() => vi.restoreAllMocks());

describe("PendingResidentsCard", () => {
  it("shows nothing when nobody waits", () => {
    const { container } = render(<PendingResidentsCard residents={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the resident, the apartment and the tickets, and approves with one tap", async () => {
    const confirm = vi.spyOn(window, "confirm");
    render(<PendingResidentsCard residents={[resident()]} />);
    expect(screen.getByText(/הירקון 112/)).toBeInTheDocument();
    expect(screen.getByText(t.inbox.ticketsOf("12, 15"))).toBeInTheDocument();
    expect(screen.queryByText(t.inbox.warnOther)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.inbox.approve }));
    await waitFor(() => expect(approveResidentAction).toHaveBeenCalledWith("p1", "u1"));
    expect(confirm).not.toHaveBeenCalled();
  });

  it("warns first when the apartment already has a resident, and approves nothing if the founder says no", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<PendingResidentsCard residents={[resident({ unitHasOtherResident: true })]} />);
    expect(screen.getByText(t.inbox.warnOther, { selector: "div" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.inbox.approve }));
    expect(confirm).toHaveBeenCalledWith(t.inbox.warnOther);
    expect(approveResidentAction).not.toHaveBeenCalled();
  });

  it("approves after the founder confirms the warning", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PendingResidentsCard residents={[resident({ unitHasOtherResident: true })]} />);
    fireEvent.click(screen.getByRole("button", { name: t.inbox.approve }));
    await waitFor(() => expect(approveResidentAction).toHaveBeenCalledWith("p1", "u1"));
  });

  it("rejects only after a confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(<PendingResidentsCard residents={[resident()]} />);
    fireEvent.click(screen.getByRole("button", { name: t.inbox.reject }));
    expect(rejectResidentAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: t.inbox.reject }));
    await waitFor(() => expect(rejectResidentAction).toHaveBeenCalledWith("p1"));
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});
