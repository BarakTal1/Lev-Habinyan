import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessagePreviewSheet } from "@/components/MessagePreviewSheet";
import type { Preview } from "@/lib/bot/templates";
import { t } from "@/lib/labels";

const preview = (over: Partial<Preview> = {}): Preview => ({
  template: "ticket_assigned", params: ["דנה", "12"], text: "שלום דנה, פנייה 12 התקבלה ושויכה לטיפול.", editable: true, ...over,
});
const setup = (p: Preview, extra: { onSkip?: () => void } = {}) => {
  const onSend = vi.fn(), onClose = vi.fn();
  render(<MessagePreviewSheet open preview={p} residentName="דנה" sendLabel={t.msg.sendAndChange} skipLabel={extra.onSkip ? t.msg.changeOnly : undefined} onSend={onSend} onSkip={extra.onSkip} onClose={onClose} />);
  return { onSend, onClose };
};

describe("MessagePreviewSheet", () => {
  it("inside the window shows an editable text, and sends the edited text", () => {
    const { onSend } = setup(preview());
    const field = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(field.value).toBe("שלום דנה, פנייה 12 התקבלה ושויכה לטיפול.");
    fireEvent.change(field, { target: { value: "שלום דנה, שלחנו מישהו" } });
    fireEvent.click(screen.getByRole("button", { name: t.msg.sendAndChange }));
    expect(onSend).toHaveBeenCalledWith("שלום דנה, שלחנו מישהו");
    expect(screen.queryByText(t.msg.locked)).toBeNull();
  });

  it("outside the window shows the text read-only with a warning, and sends no edited text", () => {
    const { onSend } = setup(preview({ editable: false }));
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("שלום דנה, פנייה 12 התקבלה ושויכה לטיפול.")).toBeInTheDocument();
    expect(screen.getByText(t.msg.locked)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: t.msg.sendAndChange }));
    expect(onSend).toHaveBeenCalledWith(undefined);
  });

  it("shows the resident name and the template name", () => {
    setup(preview());
    expect(screen.getByText("דנה")).toBeInTheDocument();
    expect(screen.getByText("ticket_assigned")).toBeInTheDocument();
  });

  it("the skip button calls onSkip, and is absent when there is no skip action", () => {
    const onSkip = vi.fn();
    const first = setup(preview(), { onSkip });
    fireEvent.click(screen.getByRole("button", { name: t.msg.changeOnly }));
    expect(onSkip).toHaveBeenCalledOnce();
    expect(first.onSend).not.toHaveBeenCalled();
  });

  it("without onSkip there is no skip button, only cancel", () => {
    const { onClose } = setup(preview());
    expect(screen.queryByRole("button", { name: t.msg.changeOnly })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: t.msg.cancel }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the yes/no buttons of the done template visible in the preview", () => {
    setup(preview({ template: "ticket_done", params: ["12"], text: "פנייה 12 טופלה. הכול תקין?", buttons: [{ id: "done_yes:12", title: "כן" }, { id: "done_no:12", title: "לא, לפתוח מחדש" }] }));
    expect(screen.getByText("כן")).toBeInTheDocument();
    expect(screen.getByText("לא, לפתוח מחדש")).toBeInTheDocument();
  });
});
