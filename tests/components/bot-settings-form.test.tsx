import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { t } from "@/lib/labels";

const save = vi.fn<(fd: FormData) => Promise<{ error?: string }>>(async () => ({}));
vi.mock("@/app/(app)/people-actions", () => ({ saveBotSettingsAction: (fd: FormData) => save(fd) }));

import { BotSettingsForm } from "@/components/BotSettingsForm";

beforeEach(() => save.mockClear());

describe("BotSettingsForm", () => {
  it("with no saved on-call list, the box is empty and the founders' phones show only as a hint", () => {
    render(<BotSettingsForm initial={{ hours: null, emergencyNumber: null, oncallPhones: [] }} fallbackPhones={["0501111111", "0502222222"]} />);
    const box = screen.getByLabelText(new RegExp(t.botSettings.oncall)) as HTMLTextAreaElement;
    expect(box.value).toBe("");
    expect(box.placeholder).toContain("0501111111");
  });

  it("saving only the hours does not turn the founders' phones into a saved list", async () => {
    render(<BotSettingsForm initial={{ hours: null, emergencyNumber: null, oncallPhones: [] }} fallbackPhones={["0501111111"]} />);
    fireEvent.click(screen.getByLabelText(t.botSettings.dayNames[0]));
    fireEvent.click(screen.getByRole("button", { name: t.botSettings.save }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0][0].get("oncall")).toBe("");
  });

  it("shows a saved list as the value", () => {
    render(<BotSettingsForm initial={{ hours: null, emergencyNumber: null, oncallPhones: ["0523333333"] }} fallbackPhones={["0501111111"]} />);
    expect((screen.getByLabelText(new RegExp(t.botSettings.oncall)) as HTMLTextAreaElement).value).toBe("0523333333");
  });
});
