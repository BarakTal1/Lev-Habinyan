import { describe, expect, it } from "vitest";
import { nextStep } from "@/lib/bot/flow";
import { bot } from "@/lib/bot/texts";
import type { Inbound, Out, StepContext } from "@/lib/bot/types";

type Ctx = Partial<Omit<StepContext, "resident">> & { resident?: Partial<StepContext["resident"]> };

function ctx(state: StepContext["state"] = null, o: Ctx = {}): StepContext {
  return {
    state,
    now: new Date("2026-10-26T10:00:00Z"),
    buildings: [],
    openTickets: [],
    hours: { open: true, text: "א-ה 8:00-17:00" },
    emergencyNumber: null,
    ...o,
    resident: { known: true, consented: true, name: "דנה", ...o.resident },
  };
}

const btn = (id: string): Inbound => ({ kind: "button", id });
const text = (t: string): Inbound => ({ kind: "text", text: t });
const emptyDraft = { photoMediaIds: [], audioMediaIds: [] };
const ids = (o: Out) => (o.type === "buttons" ? o.buttons.map((b) => b.id) : o.type === "list" ? o.rows.map((r) => r.id) : []);
const tickets = [
  { number: 101, typeLabel: "מעלית", status: "בטיפול", visit: "יום ג׳ 10:00" },
  { number: 102, typeLabel: "אינסטלציה", status: "חדש", visit: null },
];

describe("check", () => {
  it("lists open tickets with the ticket number as row id", () => {
    const r = nextStep(ctx({ step: "menu", draft: emptyDraft }, { openTickets: tickets }), btn("check"));
    expect(r.state?.step).toBe("check");
    expect(ids(r.out[0])).toEqual(["101", "102"]);
  });

  it("shows status and visit time for the picked ticket, then the menu", () => {
    const r = nextStep(ctx({ step: "check", draft: emptyDraft }, { openTickets: tickets }), btn("101"));
    expect(r.out[0]).toEqual({ type: "text", body: bot.openTicketLine(101, "מעלית", "בטיפול", "יום ג׳ 10:00") });
    expect(r.out[r.out.length - 1].type).toBe("buttons");
    expect(r.state?.step).toBe("menu");
  });

  it("with no open tickets offers to report", () => {
    const r = nextStep(ctx({ step: "menu", draft: emptyDraft }), btn("check"));
    expect(r.out[0]).toMatchObject({ type: "buttons", body: bot.noOpenTickets });
    expect(ids(r.out[0])).toEqual(["report"]);
    expect(r.state?.step).toBe("menu");
  });

  it("free text in the check step shows the menu", () => {
    const r = nextStep(ctx({ step: "check", draft: emptyDraft }, { openTickets: tickets }), text("מה המצב?"));
    expect(r.state?.step).toBe("menu");
    expect(ids(r.out[0])).toEqual(["report", "check", "agent"]);
  });
});

describe("agent", () => {
  it("emits agent_request and one reply during working hours", () => {
    const r = nextStep(ctx({ step: "menu", draft: emptyDraft }), btn("agent"));
    expect(r.state?.step).toBe("agent");
    expect(r.effects).toEqual([{ type: "agent_request" }]);
    expect(r.out).toEqual([{ type: "text", body: bot.agentOpen }]);
  });

  it("adds the hours auto-reply outside working hours", () => {
    const r = nextStep(ctx({ step: "menu", draft: emptyDraft }, { hours: { open: false, text: "א-ה 8:00-17:00" } }), btn("agent"));
    expect(r.effects).toEqual([{ type: "agent_request" }]);
    expect(r.out).toContainEqual({ type: "text", body: bot.agentClosed("א-ה 8:00-17:00") });
  });

  it("stays quiet on text while a person handles the chat", () => {
    const r = nextStep(ctx({ step: "agent", draft: emptyDraft }), text("עוד פרט"));
    expect(r.state?.step).toBe("agent");
    expect(r.out).toEqual([]);
    expect(r.effects).toEqual([]);
  });
});

describe("stop", () => {
  it.each(["stop", "STOP", " Stop ", "הפסק"])("opts out on %s with one confirmation and null state", (word) => {
    const r = nextStep(ctx({ step: "where", draft: emptyDraft }), text(word));
    expect(r.state).toBeNull();
    expect(r.effects).toEqual([{ type: "opt_out" }]);
    expect(r.out).toEqual([{ type: "text", body: bot.optOut }]);
  });

  it("opts out inside the agent step", () => {
    const r = nextStep(ctx({ step: "agent", draft: emptyDraft }), text("stop"));
    expect(r.effects).toEqual([{ type: "opt_out" }]);
    expect(r.state).toBeNull();
  });

  it("opts out also before consent", () => {
    const r = nextStep(ctx(null, { resident: { consented: false } }), text("stop"));
    expect(r.effects).toEqual([{ type: "opt_out" }]);
  });

  it("after stop a new text yields the consent prompt and no menu", () => {
    const r = nextStep(ctx(null, { resident: { known: true, consented: false } }), text("שלום"));
    expect(r.state?.step).toBe("consent");
    expect(r.out).toHaveLength(1);
    expect(ids(r.out[0])).toEqual(["consent"]);
    expect(r.effects).toEqual([]);
  });

  it("does not treat a longer sentence as stop", () => {
    const r = nextStep(ctx({ step: "details", draft: emptyDraft }), text("אל תפסיקו לבוא"));
    expect(r.effects.some((e) => e.type === "opt_out")).toBe(false);
  });
});

describe("time-out and fallbacks", () => {
  it("a null state (expired chat) starts at the menu", () => {
    const r = nextStep(ctx(null), text("שלום"));
    expect(r.state).toEqual({ step: "menu", draft: emptyDraft });
    expect(ids(r.out[0])).toEqual(["report", "check", "agent"]);
  });

  it("an unsupported message mid-flow shows the menu and clears the draft", () => {
    const draft = { where: "unit" as const, typeId: "lift", photoMediaIds: ["m1"], audioMediaIds: [] };
    const r = nextStep(ctx({ step: "danger", draft }), { kind: "other" });
    expect(r.state).toEqual({ step: "menu", draft: emptyDraft });
    expect(ids(r.out[0])).toEqual(["report", "check", "agent"]);
  });

  it("a stale button id at the menu shows the menu", () => {
    const r = nextStep(ctx({ step: "menu", draft: emptyDraft }), btn("confirm"));
    expect(r.state?.step).toBe("menu");
    expect(ids(r.out[0])).toEqual(["report", "check", "agent"]);
  });

  const full = { where: "common" as const, place: "roof", typeId: "lift", danger: false, text: "x",
    photoMediaIds: ["m1"], audioMediaIds: [] };
  it.each([
    ["where", btn("confirm")], ["danger", btn("confirm")], ["summary", btn("danger_yes")],
    ["where", text("בלה")], ["summary", text("בלה")], ["type", btn("roof")], ["place", btn("electric")],
    ["fix", text("בלה")], ["fix", btn("confirm")],
  ] as const)("stale input at %s shows the menu and drops the draft", (step, input) => {
    const r = nextStep(ctx({ step, draft: full }), input);
    expect(r.state).toEqual({ step: "menu", draft: emptyDraft });
    expect(ids(r.out[0])).toEqual(["report", "check", "agent"]);
    expect(r.effects).toEqual([]);
  });

  it("free text at the menu shows the menu", () => {
    const r = nextStep(ctx({ step: "menu", draft: { ...emptyDraft, text: "old" } }), text("היי"));
    expect(r.state).toEqual({ step: "menu", draft: emptyDraft });
  });
});
