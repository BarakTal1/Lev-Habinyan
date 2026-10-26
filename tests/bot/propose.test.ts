import { describe, expect, it } from "vitest";
import { proposeFields } from "@/lib/bot/propose";
import { FAULT_TYPES, PLACES } from "@/lib/bot/catalog";

const typeTitle = (id: string) => FAULT_TYPES.find((x) => x.id === id)!.title;
const placeTitle = (id: string) => PLACES.find((x) => x.id === id)!.title;

describe("proposeFields", () => {
  it("lift in the lobby is very important", () => {
    const r = proposeFields({ typeId: "lift", where: "common", placeTitle: placeTitle("lobby"), text: "  תקוע  " });
    expect(r.title).toBe("מעלית · לובי");
    expect(r.urgency).toBe("חשוב מאוד");
    expect(r.description).toBe("תקוע");
    expect(r.responsibility).toBe("לא ידוע");
  });
  it("plumbing in a unit is very important", () => {
    const r = proposeFields({ typeId: "plumbing", where: "unit" });
    expect(r.title).toBe(`${typeTitle("plumbing")} · בדירה`);
    expect(r.urgency).toBe("חשוב מאוד");
    expect(r.responsibility).toBe("לא ידוע");
  });
  it("garden is important and has an empty description without text", () => {
    const r = proposeFields({ typeId: "garden", where: "common", placeTitle: placeTitle("roof") });
    expect(r.urgency).toBe("חשוב");
    expect(r.description).toBe("");
    expect(r.responsibility).toBe("לא ידוע");
  });
  it("unknown type uses other", () => {
    const r = proposeFields({ typeId: "nope", where: "unit", text: "   " });
    expect(r.title).toBe(`${typeTitle("other")} · בדירה`);
    expect(r.urgency).toBe("חשוב");
    expect(r.description).toBe("");
    expect(r.responsibility).toBe("לא ידוע");
  });
  it("common without place title uses the type title alone", () => {
    expect(proposeFields({ typeId: "gate", where: "common" }).title).toBe(typeTitle("gate"));
  });
});
