import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Preview } from "@/lib/bot/templates";
import { t } from "@/lib/labels";

const preview: Preview = { template: "ticket_assigned", params: ["דנה", "12"], text: "שלום דנה, פנייה 12 התקבלה.", editable: true };
let previewResult: Preview | null = preview;
const previewStatusAction = vi.fn(async () => previewResult);
const setStatusAction = vi.fn<(...args: unknown[]) => Promise<{ delivery: "sent" | "failed" | null }>>(async () => ({ delivery: "sent" }));
vi.mock("@/app/(app)/tickets/actions", () => ({
  previewStatusAction: (...a: []) => previewStatusAction(...a),
  setStatusAction: (...a: unknown[]) => setStatusAction(...a),
}));

import { StatusControl } from "@/components/StatusControl";

const pick = (status: string) => fireEvent.change(screen.getByLabelText(t.tickets.status), { target: { value: status } });

beforeEach(() => { previewResult = preview; previewStatusAction.mockClear(); setStatusAction.mockClear(); });

describe("StatusControl", () => {
  it("a status with a message opens the preview, and does not change the status yet", async () => {
    render(<StatusControl id="t1" status="חדש" residentName="דנה" />);
    pick("הוקצה");
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(previewStatusAction).toHaveBeenCalledWith("t1", "הוקצה");
    expect(setStatusAction).not.toHaveBeenCalled();
  });

  it("send message and change status sends the edited text", async () => {
    render(<StatusControl id="t1" status="חדש" residentName="דנה" />);
    pick("הוקצה");
    fireEvent.change(await screen.findByRole("textbox"), { target: { value: "שלום, שלחנו מישהו" } });
    fireEvent.click(screen.getByRole("button", { name: t.msg.sendAndChange }));
    await waitFor(() => expect(setStatusAction).toHaveBeenCalledWith("t1", "הוקצה", { text: "שלום, שלחנו מישהו" }));
  });

  it("change status without a message sends no message", async () => {
    render(<StatusControl id="t1" status="חדש" residentName="דנה" />);
    pick("הוקצה");
    fireEvent.click(await screen.findByRole("button", { name: t.msg.changeOnly }));
    await waitFor(() => expect(setStatusAction).toHaveBeenCalledWith("t1", "הוקצה", undefined));
  });

  it("a status with no message changes at once, with no preview call", async () => {
    render(<StatusControl id="t1" status="חדש" residentName="דנה" />);
    pick("בטיפול");
    await waitFor(() => expect(setStatusAction).toHaveBeenCalledWith("t1", "בטיפול"));
    expect(previewStatusAction).not.toHaveBeenCalled();
  });

  it("changes at once when the server has no message for this resident", async () => {
    previewResult = null;
    render(<StatusControl id="t1" status="חדש" residentName="דנה" />);
    pick("הוקצה");
    await waitFor(() => expect(setStatusAction).toHaveBeenCalledWith("t1", "הוקצה"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("changes at once when the ticket has no resident", async () => {
    render(<StatusControl id="t1" status="חדש" residentName={null} />);
    pick("בוצע");
    await waitFor(() => expect(setStatusAction).toHaveBeenCalledWith("t1", "בוצע"));
    expect(previewStatusAction).not.toHaveBeenCalled();
  });

  it("shows a notice when the message could not be sent, and the status still changed", async () => {
    setStatusAction.mockResolvedValueOnce({ delivery: "failed" });
    render(<StatusControl id="t1" status="חדש" residentName="דנה" />);
    pick("הוקצה");
    fireEvent.click(await screen.findByRole("button", { name: t.msg.sendAndChange }));
    expect(await screen.findByRole("status")).toHaveTextContent(t.msg.sendFailed);
  });
});
