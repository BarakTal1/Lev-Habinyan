import { describe, expect, it } from "vitest";
import { nextStep } from "@/lib/bot/flow";
import type { Inbound, Out, StepContext, StepResult } from "@/lib/bot/types";

function ctx(state: StepContext["state"] = null): StepContext {
  return {
    state,
    now: new Date("2026-10-26T10:00:00Z"),
    resident: { known: true, consented: true, name: "דנה" },
    buildings: [],
    openTickets: [],
    hours: { open: true, text: "א-ה 8:00-17:00" },
    emergencyNumber: null,
  };
}

const btn = (id: string): Inbound => ({ kind: "button", id });
const text = (t: string): Inbound => ({ kind: "text", text: t });
const image = (mediaId: string): Inbound => ({ kind: "image", mediaId });

/** Feed inputs one by one. The first input starts from a null state. */
function run(inputs: Inbound[]): { last: StepResult; all: StepResult[] } {
  const all: StepResult[] = [];
  let state: StepContext["state"] = null;
  for (const input of inputs) {
    const r = nextStep(ctx(state), input);
    all.push(r);
    state = r.state;
  }
  return { last: all[all.length - 1], all };
}

function assertLimits(out: Out[]) {
  for (const o of out) {
    if (o.type === "buttons") {
      expect(o.buttons.length).toBeLessThanOrEqual(3);
      expect(o.body.length).toBeLessThanOrEqual(1024);
      for (const b of o.buttons) expect(b.title.length).toBeLessThanOrEqual(20);
    }
    if (o.type === "list") {
      expect(o.rows.length).toBeLessThanOrEqual(10);
      expect(o.button.length).toBeLessThanOrEqual(20);
      expect(o.body.length).toBeLessThanOrEqual(1024);
      for (const r of o.rows) expect(r.title.length).toBeLessThanOrEqual(24);
    }
  }
}

const ids = (o: Out | undefined) =>
  o?.type === "buttons" ? o.buttons.map((b) => b.id) : o?.type === "list" ? o.rows.map((r) => r.id) : [];

const toDetailsUnit = [text("שלום"), btn("report"), btn("unit"), btn("lift"), btn("danger_no")];

describe("report-a-fault flow", () => {
  it("shows the menu for a known consented resident with no state", () => {
    const r = nextStep(ctx(null), text("שלום"));
    expect(r.state?.step).toBe("menu");
    expect(ids(r.out[0])).toEqual(["report", "check", "agent"]);
    expect(r.effects).toEqual([]);
    assertLimits(r.out);
  });

  it("report goes to where with unit and common buttons", () => {
    const { last } = run([text("שלום"), btn("report")]);
    expect(last.state?.step).toBe("where");
    expect(ids(last.out[0])).toEqual(["unit", "common"]);
    assertLimits(last.out);
  });

  it("common goes to place with a list of PLACES", () => {
    const { last } = run([text("שלום"), btn("report"), btn("common")]);
    expect(last.state?.step).toBe("place");
    expect(ids(last.out[0])).toEqual(["lobby", "stairs", "parking", "roof", "lift", "other"]);
    assertLimits(last.out);
  });

  it("unit skips place and goes to type with a list of FAULT_TYPES", () => {
    const { all, last } = run([text("שלום"), btn("report"), btn("unit")]);
    expect(all.map((r) => r.state?.step)).not.toContain("place");
    expect(last.state?.step).toBe("type");
    expect(ids(last.out[0])).toContain("plumbing");
    assertLimits(last.out);
  });

  it("type goes to the danger question", () => {
    const { last } = run([...toDetailsUnit.slice(0, 4)]);
    expect(last.state?.step).toBe("danger");
    expect(ids(last.out[0])).toEqual(["danger_yes", "danger_no"]);
    assertLimits(last.out);
  });

  it("danger_yes sets draft.danger true", () => {
    const { last } = run([...toDetailsUnit.slice(0, 4), btn("danger_yes")]);
    expect(last.state?.step).toBe("details");
    expect(last.state?.draft.danger).toBe(true);
  });

  it("a photo with a text moves to the summary", () => {
    const { last } = run([...toDetailsUnit, image("m1"), text("נזילה בתקרה")]);
    expect(last.state?.step).toBe("summary");
    expect(last.state?.draft.photoMediaIds).toEqual(["m1"]);
    expect(last.state?.draft.text).toBe("נזילה בתקרה");
    expect(ids(last.out[last.out.length - 1])).toEqual(["confirm", "fix"]);
    assertLimits(last.out);
  });

  it("a text alone moves to the summary", () => {
    const { last } = run([...toDetailsUnit, text("המעלית לא עובדת")]);
    expect(last.state?.step).toBe("summary");
  });

  it("an image caption counts as the text", () => {
    const { last } = run([...toDetailsUnit, { kind: "image", mediaId: "m1", caption: "דלת שבורה" }]);
    expect(last.state?.step).toBe("summary");
    expect(last.state?.draft.text).toBe("דלת שבורה");
  });

  it("a photo alone asks what the problem is, once", () => {
    const first = run([...toDetailsUnit, image("m1")]);
    expect(first.last.state?.step).toBe("details");
    expect(JSON.stringify(first.last.out)).toContain("מה הבעיה?");
    const second = nextStep(ctx(first.last.state), image("m2"));
    expect(second.state?.step).toBe("summary");
    expect(second.state?.draft.photoMediaIds).toEqual(["m1", "m2"]);
  });

  it("an audio message is stored in audioMediaIds", () => {
    const { last } = run([...toDetailsUnit, { kind: "audio", mediaId: "a1" }, text("רעש")]);
    expect(last.state?.draft.audioMediaIds).toEqual(["a1"]);
    expect(last.state?.step).toBe("summary");
  });

  it("a danger word in the text re-asks the danger question once", () => {
    const first = run([...toDetailsUnit, text("יש הצפה בחדר")]);
    expect(first.last.state?.step).toBe("danger");
    expect(ids(first.last.out[0])).toEqual(["danger_yes", "danger_no"]);
    const answered = nextStep(ctx(first.last.state), btn("danger_no"));
    expect(answered.state?.step).toBe("summary");
    expect(answered.state?.draft.danger).toBe(false);
  });

  it("a danger word does not re-ask when danger is already true", () => {
    const { last } = run([...toDetailsUnit.slice(0, 4), btn("danger_yes"), text("יש הצפה")]);
    expect(last.state?.step).toBe("summary");
  });

  it("fix returns to summary after the chosen step", () => {
    const sum = run([...toDetailsUnit, text("המעלית תקועה קצת")]).last;
    const fix = nextStep(ctx(sum.state), btn("fix"));
    expect(fix.state?.step).toBe("fix");
    expect(ids(fix.out[0])).toEqual(["where", "type", "details"]);
    assertLimits(fix.out);
    const typeStep = nextStep(ctx(fix.state), btn("type"));
    expect(typeStep.state?.step).toBe("type");
    const back = nextStep(ctx(typeStep.state), btn("plumbing"));
    expect(back.state?.step).toBe("summary");
    expect(back.state?.draft.typeId).toBe("plumbing");
  });

  it("fix where to common asks for the place, then returns to summary", () => {
    const sum = run([...toDetailsUnit, text("תקלה")]).last;
    const fix = nextStep(ctx(sum.state), btn("fix"));
    const where = nextStep(ctx(fix.state), btn("where"));
    const place = nextStep(ctx(where.state), btn("common"));
    expect(place.state?.step).toBe("place");
    const back = nextStep(ctx(place.state), btn("roof"));
    expect(back.state?.step).toBe("summary");
    expect(back.state?.draft).toMatchObject({ where: "common", place: "roof" });
  });

  it("fix details clears the old text and accepts a new one", () => {
    const sum = run([...toDetailsUnit, text("ישן")]).last;
    const fix = nextStep(ctx(sum.state), btn("fix"));
    const det = nextStep(ctx(fix.state), btn("details"));
    expect(det.state?.step).toBe("details");
    expect(det.state?.draft.text).toBeUndefined();
    const back = nextStep(ctx(det.state), text("חדש"));
    expect(back.state?.step).toBe("summary");
    expect(back.state?.draft.text).toBe("חדש");
  });

  it("full happy path ends with one create_ticket effect", () => {
    const { all, last } = run([
      text("שלום"), btn("report"), btn("common"), btn("parking"), btn("electric"), btn("danger_no"),
      image("m1"), text("אין תאורה"), btn("confirm"),
    ]);
    const effects = all.flatMap((r) => r.effects);
    expect(effects).toHaveLength(1);
    expect(effects[0]).toMatchObject({
      type: "create_ticket",
      draft: { where: "common", place: "parking", typeId: "electric", danger: false, text: "אין תאורה", photoMediaIds: ["m1"] },
    });
    expect(last.state).toBeNull();
    for (const r of all) assertLimits(r.out);
  });

  it("an unexpected input re-sends the current question", () => {
    const { last } = run([text("שלום"), btn("report"), text("בלה")]);
    expect(last.state?.step).toBe("where");
    expect(ids(last.out[last.out.length - 1])).toEqual(["unit", "common"]);
  });
});
