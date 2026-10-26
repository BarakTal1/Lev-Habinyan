// Shared prompts and helpers for the chat flow handlers.
import { FAULT_TYPES, PLACES } from "./catalog";
import { bot } from "./texts";
import type { ChatState, Draft, Effect, Inbound, Out, Step, StepContext, StepResult } from "./types";

export type Handler = (state: ChatState, input: Inbound, ctx: StepContext) => StepResult;

export const emptyDraft = (): Draft => ({ photoMediaIds: [], audioMediaIds: [] });

// ---- Prompts: the message that asks for each step ----

export const menuPrompt = (): Out => ({
  type: "buttons",
  body: bot.menu,
  buttons: [
    { id: "report", title: bot.btn.report },
    { id: "check", title: bot.btn.existing },
    { id: "agent", title: bot.btn.agent },
  ],
});

export const wherePrompt = (): Out => ({
  type: "buttons",
  body: bot.whereQ,
  buttons: [
    { id: "unit", title: bot.btn.unit },
    { id: "common", title: bot.btn.common },
  ],
});

export const placePrompt = (): Out => ({
  type: "list",
  body: bot.placeQ,
  button: bot.placeButton,
  rows: PLACES.map((p) => ({ id: p.id, title: p.title })),
});

export const typePrompt = (): Out => ({
  type: "list",
  body: bot.typeQ,
  button: bot.typeButton,
  rows: FAULT_TYPES.map((t) => ({ id: t.id, title: t.title })),
});

export const dangerPrompt = (): Out => ({
  type: "buttons",
  body: bot.dangerQ,
  buttons: [
    { id: "danger_yes", title: bot.btn.danger },
    { id: "danger_no", title: bot.btn.noDanger },
  ],
});

export const detailsPrompt = (): Out => ({ type: "text", body: bot.detailsQ });

export const MAX_SUMMARY_TEXT = 500;

export function summaryPrompt(d: Draft): Out {
  const where =
    d.where === "common"
      ? [bot.summaryCommon, PLACES.find((p) => p.id === d.place)?.title].filter(Boolean).join(" · ")
      : bot.summaryUnit;
  const type = FAULT_TYPES.find((t) => t.id === d.typeId)?.title ?? "";
  const lines = [bot.summaryTitle, `${bot.summaryWhere}: ${where}`, `${bot.summaryType}: ${type}`];
  if (d.text) lines.push(`${bot.summaryText}: ${d.text.slice(0, MAX_SUMMARY_TEXT)}`);
  lines.push(bot.summaryOk);
  return {
    type: "buttons",
    body: lines.join("\n"),
    buttons: [
      { id: "confirm", title: bot.btn.confirm },
      { id: "fix", title: bot.btn.fix },
    ],
  };
}

export const fixPrompt = (): Out => ({
  type: "list",
  body: bot.fixQ,
  button: bot.fixButton,
  rows: [
    { id: "where", title: bot.fixWhere },
    { id: "type", title: bot.fixType },
    { id: "details", title: bot.fixText },
  ],
});

export const consentPrompt = (): Out => ({
  type: "buttons",
  body: `${bot.consent}\n${bot.privacyLink}`,
  buttons: [{ id: "consent", title: bot.btn.agree }],
});

// WhatsApp lists hold 10 rows. One row is the "not on the list" row.
export const MAX_BUILDINGS_IN_LIST = 9;
export const MAX_LIST_ROWS = 10;
export const MAX_ROW_TITLE = 24;

export const buildingPrompt = (ctx: StepContext): Out => ({
  type: "list",
  body: bot.unkBuildingQ,
  button: bot.unkBuildingButton,
  rows: [
    ...ctx.buildings.map((b) => ({ id: b.id, title: b.name.slice(0, MAX_ROW_TITLE) })),
    { id: "none", title: bot.btn.notListed },
  ],
});

export const streetPrompt = (): Out => ({ type: "text", body: bot.unkStreetQ });
export const unitPrompt = (): Out => ({ type: "text", body: bot.unkUnitQ });
export const namePrompt = (): Out => ({ type: "text", body: bot.unkNameQ });

export const relationPrompt = (): Out => ({
  type: "buttons",
  body: bot.unkRelationQ,
  buttons: [
    { id: "owner", title: bot.btn.owner },
    { id: "tenant", title: bot.btn.tenant },
    { id: "committee", title: bot.btn.committee },
  ],
});

// ---- Helpers ----

export const go = (step: Step, draft: Draft, ...out: Out[]): StepResult => ({ state: { step, draft }, out, effects: [] });

/** Stale button, free text or an unsupported message: back to the menu, the draft is dropped. */
export const toMenu = (): StepResult => go("menu", emptyDraft(), menuPrompt());

/** Send the question of the current step again. Used by the consent, details and unknown-number steps only. */
export function reprompt(state: ChatState, ctx: StepContext): StepResult {
  const prompt: Partial<Record<Step, (d: Draft) => Out>> = {
    details: detailsPrompt,
    consent: consentPrompt, unk_street: streetPrompt, unk_unit: unitPrompt, unk_name: namePrompt,
    unk_relation: relationPrompt, unk_building: () => buildingPrompt(ctx),
  };
  const make = prompt[state.step];
  if (!make) throw new Error(`No prompt for step ${state.step}`);
  return go(state.step, state.draft, make(state.draft));
}

/** Send the resident to a person. Used when the building is unknown or not on the list. */
export const toAgent = (draft: Draft): StepResult => ({
  state: { step: "agent", draft },
  out: [{ type: "text", body: bot.unkBuildingNotListed }],
  effects: [{ type: "agent_request" }],
});

/** After consent, an unknown number gives its building: a list for few buildings, a street name for many. */
export function askBuilding(draft: Draft, ctx: StepContext, effects: Effect[]): StepResult {
  // No building in the system: a person decides.
  if (ctx.buildings.length === 0) {
    const r = toAgent(draft);
    return { ...r, effects: [...effects, ...r.effects] };
  }
  const intro: Out = { type: "text", body: bot.unkIntro };
  const result = ctx.buildings.length <= MAX_BUILDINGS_IN_LIST
    ? go("unk_building", draft, intro, buildingPrompt(ctx))
    : go("unk_street", draft, intro, streetPrompt());
  return { ...result, effects };
}
