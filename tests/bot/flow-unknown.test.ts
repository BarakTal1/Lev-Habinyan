import { describe, expect, it } from "vitest";
import { nextStep } from "@/lib/bot/flow";
import { bot } from "@/lib/bot/texts";
import type { Inbound, Out, StepContext, StepResult } from "@/lib/bot/types";

type Building = StepContext["buildings"][number];

const makeBuildings = (n: number): Building[] =>
  Array.from({ length: n }, (_, i) => ({ id: `b${i + 1}`, name: `בניין ${i + 1}`, address: `רחוב ${i + 1}` }));

function ctx(state: StepContext["state"], opts: { known?: boolean; consented?: boolean; buildings?: Building[] } = {}): StepContext {
  return {
    state,
    now: new Date("2026-10-26T10:00:00Z"),
    resident: { known: opts.known ?? false, consented: opts.consented ?? false },
    buildings: opts.buildings ?? makeBuildings(3),
    openTickets: [],
    hours: { open: true, text: "א-ה 8:00-17:00" },
    emergencyNumber: null,
  };
}

const btn = (id: string): Inbound => ({ kind: "button", id });
const text = (t: string): Inbound => ({ kind: "text", text: t });

/** Feed inputs one by one for an unknown number. The resident counts as consented after the consent button. */
function run(inputs: Inbound[], buildings: Building[] = makeBuildings(3)) {
  const all: StepResult[] = [];
  let state: StepContext["state"] = null;
  let consented = false;
  for (const input of inputs) {
    const r = nextStep(ctx(state, { consented, buildings }), input);
    if (r.effects.some((e) => e.type === "save_consent")) consented = true;
    all.push(r);
    state = r.state;
  }
  return { last: all[all.length - 1], all };
}

function assertLimits(out: Out[]) {
  for (const o of out) {
    if (o.type === "buttons") {
      expect(o.buttons.length).toBeLessThanOrEqual(3);
      for (const b of o.buttons) expect(b.title.length).toBeLessThanOrEqual(20);
    }
    if (o.type === "list") {
      expect(o.rows.length).toBeLessThanOrEqual(10);
      for (const r of o.rows) expect(r.title.length).toBeLessThanOrEqual(24);
    }
  }
}

describe("consent", () => {
  it("asks for consent on the first message of an unknown number and keeps the text", () => {
    const r = nextStep(ctx(null), text("יש לי נזילה"));
    expect(r.state?.step).toBe("consent");
    expect(r.state?.draft.firstText).toBe("יש לי נזילה");
    expect(r.effects).toEqual([]);
    expect(r.out).toHaveLength(1);
    const o = r.out[0];
    expect(o.type).toBe("buttons");
    if (o.type === "buttons") expect(o.buttons.map((b) => b.id)).toContain("consent");
    expect(JSON.stringify(r.out)).not.toContain("יש לי נזילה");
  });

  it("asks for consent from a known resident who did not consent, without firstText", () => {
    const r = nextStep(ctx(null, { known: true }), text("שלום"));
    expect(r.state?.step).toBe("consent");
    expect(r.state?.draft.firstText).toBeUndefined();
    expect(r.out).toHaveLength(1);
  });

  it("sends only the consent prompt until the resident presses consent", () => {
    const { all } = run([text("היי"), text("אני רוצה לדווח"), btn("other")]);
    for (const r of all) {
      expect(r.state?.step).toBe("consent");
      expect(r.effects).toEqual([]);
      expect(r.out).toHaveLength(1);
      expect(r.out[0].type).toBe("buttons");
    }
  });

  it("known resident: consent saves and shows the menu", () => {
    const first = nextStep(ctx(null, { known: true }), text("שלום"));
    const r = nextStep(ctx(first.state, { known: true }), btn("consent"));
    expect(r.effects).toEqual([{ type: "save_consent" }]);
    expect(r.state?.step).toBe("menu");
  });
});

describe("building", () => {
  it("shows a list with a none row for 9 buildings or fewer", () => {
    const { last } = run([text("היי"), btn("consent")], makeBuildings(9));
    expect(last.effects).toEqual([{ type: "save_consent" }]);
    expect(last.state?.step).toBe("unk_building");
    const list = last.out.find((o) => o.type === "list");
    expect(list?.type === "list" && list.rows).toHaveLength(10);
    if (list?.type === "list") {
      expect(list.rows[list.rows.length - 1]).toEqual({ id: "none", title: "הבניין שלי לא ברשימה" });
    }
    assertLimits(last.out);
  });

  it("asks for a street name at exactly 10 buildings", () => {
    const { last } = run([text("היי"), btn("consent")], makeBuildings(10));
    expect(last.state?.step).toBe("unk_street");
    expect(last.out.some((o) => o.type === "list")).toBe(false);
  });

  it("goes straight to the agent step with 0 buildings", () => {
    const { last } = run([text("היי"), btn("consent")], []);
    expect(last.state?.step).toBe("agent");
    expect(last.effects).toEqual([{ type: "save_consent" }, { type: "agent_request" }]);
  });

  it("re-asks a blank street", () => {
    const { last } = run([text("היי"), btn("consent"), text("   ")], makeBuildings(11));
    expect(last.state?.step).toBe("unk_street");
    expect(last.effects).toEqual([]);
    expect(last.out).toEqual([{ type: "text", body: bot.unkStreetQ }]);
  });

  it("re-asks a blank unit and a blank name", () => {
    const unit = run([text("היי"), btn("consent"), btn("b1"), text("  ")]);
    expect(unit.last.state?.step).toBe("unk_unit");
    expect(unit.last.out).toEqual([{ type: "text", body: bot.unkUnitQ }]);
    const name = run([text("היי"), btn("consent"), btn("b1"), text("5"), text(" ")]);
    expect(name.last.state?.step).toBe("unk_name");
    expect(name.last.out).toEqual([{ type: "text", body: bot.unkNameQ }]);
  });

  it("trims and caps unit and name at 60 characters", () => {
    const { last } = run([text("היי"), btn("consent"), btn("b1"), text(`  ${"1".repeat(80)}  `), text(`${"א".repeat(70)} `)]);
    expect(last.state?.draft.unitNumber).toBe("1".repeat(60));
    expect(last.state?.draft.name).toBe("א".repeat(60));
  });

  it("shows a list for 3 buildings", () => {
    const { last } = run([text("היי"), btn("consent")], makeBuildings(3));
    expect(last.out.some((o) => o.type === "list")).toBe(true);
  });

  it("asks for a street name when there are more buildings than a list holds", () => {
    const { last } = run([text("היי"), btn("consent")], makeBuildings(11));
    expect(last.state?.step).toBe("unk_street");
    expect(last.out.some((o) => o.type === "list")).toBe(false);
  });

  it("goes to the agent step when the building is not on the list", () => {
    const { last } = run([text("היי"), btn("consent"), btn("none")]);
    expect(last.state?.step).toBe("agent");
    expect(last.effects).toEqual([{ type: "agent_request" }]);
    expect(last.out.length).toBeGreaterThan(0);
  });

  it("goes to the agent step when the street does not match", () => {
    const { last } = run([text("היי"), btn("consent"), text("רחוב לא קיים 5")], makeBuildings(11));
    expect(last.state?.step).toBe("agent");
    expect(last.effects).toEqual([{ type: "agent_request" }]);
  });

  it("goes to the agent step when the street matches several buildings", () => {
    const buildings = makeBuildings(11).map((b) => ({ ...b, address: "הרצל 1" }));
    const { last } = run([text("היי"), btn("consent"), text("הרצל")], buildings);
    expect(last.state?.step).toBe("agent");
    expect(last.effects).toEqual([{ type: "agent_request" }]);
  });

  it("continues with one street match, ignoring case", () => {
    const buildings = makeBuildings(11).map((b, i) => ({ ...b, address: i === 4 ? "Herzl 7" : `Other ${i}` }));
    const { last } = run([text("היי"), btn("consent"), text("herzl")], buildings);
    expect(last.state?.step).toBe("unk_unit");
    expect(last.state?.draft.buildingId).toBe("b5");
  });

  it("asks again when the resident types text instead of choosing from the list", () => {
    const { last } = run([text("היי"), btn("consent"), text("בניין 2")]);
    expect(last.state?.step).toBe("unk_building");
    expect(last.out.some((o) => o.type === "list")).toBe(true);
  });
});

describe("full path", () => {
  it("emits register_unknown with building, unit, name and relation", () => {
    const { all, last } = run([
      text("יש נזילה"), btn("consent"), btn("b2"), text("12"), text("דנה כהן"), btn("tenant"),
    ]);
    expect(all[2].state?.step).toBe("unk_unit");
    expect(all[3].state?.step).toBe("unk_name");
    expect(all[4].state?.step).toBe("unk_relation");
    expect(last.effects).toHaveLength(1);
    const e = last.effects[0];
    expect(e.type).toBe("register_unknown");
    if (e.type === "register_unknown") {
      expect(e.draft).toMatchObject({ buildingId: "b2", unitNumber: "12", name: "דנה כהן", relation: "tenant", firstText: "יש נזילה" });
    }
    expect(last.state?.step).toBe("menu");
    const menu = last.out.find((o) => o.type === "buttons");
    expect(menu?.type === "buttons" && menu.buttons.map((b) => b.id)).toEqual(["report", "agent"]);
    assertLimits(last.out);
  });

  it("asks again when the relation answer is not a button", () => {
    const { last } = run([text("היי"), btn("consent"), btn("b1"), text("3"), text("רון"), text("בעלים")]);
    expect(last.state?.step).toBe("unk_relation");
    expect(last.effects).toEqual([]);
  });
});
