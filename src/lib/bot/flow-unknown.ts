// Handlers for consent and the unknown-number registration (spec 6.1, steps 2 and 3).
import { bot } from "./texts";
import { askBuilding, emptyDraft, go, menuPrompt, relationPrompt, reprompt, toAgent, unitPrompt, namePrompt } from "./flow-common";
import type { Handler } from "./flow-common";
import type { Effect } from "./types";

// Unit and name are free text. 60 characters are enough.
const MAX_FIELD = 60;

export const onConsent: Handler = (state, input, ctx) => {
  if (input.kind !== "button" || input.id !== "consent") return reprompt(state, ctx);
  const effects: Effect[] = [{ type: "save_consent" }];
  if (!ctx.resident.known) return askBuilding(state.draft, ctx, effects);
  return { ...go("menu", emptyDraft(), menuPrompt()), effects };
};

export const onBuilding: Handler = (state, input, ctx) => {
  if (input.kind !== "button") return reprompt(state, ctx);
  if (input.id === "none") return toAgent(state.draft);
  if (!ctx.buildings.some((b) => b.id === input.id)) return reprompt(state, ctx);
  return go("unk_unit", { ...state.draft, buildingId: input.id }, unitPrompt());
};

export const onStreet: Handler = (state, input, ctx) => {
  if (input.kind !== "text") return reprompt(state, ctx);
  const typed = input.text.trim().toLowerCase();
  if (!typed) return reprompt(state, ctx);
  const matches = ctx.buildings.filter((b) => b.address?.toLowerCase().includes(typed));
  // No match or several matches: a person decides.
  if (matches.length !== 1) return toAgent(state.draft);
  return go("unk_unit", { ...state.draft, buildingId: matches[0].id }, unitPrompt());
};

export const onUnit: Handler = (state, input, ctx) => {
  const unit = input.kind === "text" ? input.text.trim().slice(0, MAX_FIELD) : "";
  if (!unit) return reprompt(state, ctx);
  return go("unk_name", { ...state.draft, unitNumber: unit }, namePrompt());
};

export const onName: Handler = (state, input, ctx) => {
  const name = input.kind === "text" ? input.text.trim().slice(0, MAX_FIELD) : "";
  if (!name) return reprompt(state, ctx);
  return go("unk_relation", { ...state.draft, name }, relationPrompt());
};

const RELATIONS = ["owner", "tenant", "committee"] as const;

export const onRelation: Handler = (state, input, ctx) => {
  const relation = input.kind === "button" ? RELATIONS.find((r) => r === input.id) : undefined;
  if (!relation) return reprompt(state, ctx);
  const draft = { ...state.draft, relation };
  const building = ctx.buildings.find((b) => b.id === draft.buildingId)?.name ?? "";
  return {
    state: { step: "menu", draft },
    out: [
      { type: "text", body: `${bot.unkThanks(draft.name ?? "", building, draft.unitNumber ?? "")} ${bot.unkPending}` },
      {
        type: "buttons",
        body: bot.unkContinue,
        buttons: [
          { id: "report", title: bot.btn.report },
          { id: "agent", title: bot.btn.agent },
        ],
      },
    ],
    effects: [{ type: "register_unknown", draft }],
  };
};
