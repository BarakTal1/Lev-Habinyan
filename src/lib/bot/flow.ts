// Chat flow for the WhatsApp bot. Pure function: state and input in, state, messages and effects out.
// This file handles the known, consented resident who reports a fault (spec 6.1, steps 3 to 5).
import { FAULT_TYPES, PLACES, hasDangerWord } from "./catalog";
import { bot } from "./texts";
import type { ChatState, Draft, Effect, Inbound, Out, Step, StepContext, StepResult } from "./types";

type Handler = (state: ChatState, input: Inbound, ctx: StepContext) => StepResult;

const emptyDraft = (): Draft => ({ photoMediaIds: [], audioMediaIds: [] });

// ---- Prompts: the message that asks for each step ----

const menuPrompt = (): Out => ({
  type: "buttons",
  body: bot.menu,
  buttons: [
    { id: "report", title: bot.btn.report },
    { id: "check", title: bot.btn.existing },
    { id: "agent", title: bot.btn.agent },
  ],
});

const wherePrompt = (): Out => ({
  type: "buttons",
  body: bot.whereQ,
  buttons: [
    { id: "unit", title: bot.btn.unit },
    { id: "common", title: bot.btn.common },
  ],
});

const placePrompt = (): Out => ({
  type: "list",
  body: bot.placeQ,
  button: bot.placeButton,
  rows: PLACES.map((p) => ({ id: p.id, title: p.title })),
});

const typePrompt = (): Out => ({
  type: "list",
  body: bot.typeQ,
  button: bot.typeButton,
  rows: FAULT_TYPES.map((t) => ({ id: t.id, title: t.title })),
});

const dangerPrompt = (): Out => ({
  type: "buttons",
  body: bot.dangerQ,
  buttons: [
    { id: "danger_yes", title: bot.btn.danger },
    { id: "danger_no", title: bot.btn.noDanger },
  ],
});

const detailsPrompt = (): Out => ({ type: "text", body: bot.detailsQ });

const MAX_SUMMARY_TEXT = 500;

function summaryPrompt(d: Draft): Out {
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

const fixPrompt = (): Out => ({
  type: "list",
  body: bot.fixQ,
  button: bot.fixButton,
  rows: [
    { id: "where", title: bot.fixWhere },
    { id: "type", title: bot.fixType },
    { id: "details", title: bot.fixText },
  ],
});

const consentPrompt = (): Out => ({
  type: "buttons",
  body: `${bot.consent}\n${bot.privacyLink}`,
  buttons: [{ id: "consent", title: bot.btn.agree }],
});

// WhatsApp lists hold 10 rows. One row is the "not on the list" row.
const MAX_BUILDINGS_IN_LIST = 9;
const MAX_ROW_TITLE = 24;

const buildingPrompt = (ctx: StepContext): Out => ({
  type: "list",
  body: bot.unkBuildingQ,
  button: bot.unkBuildingButton,
  rows: [
    ...ctx.buildings.map((b) => ({ id: b.id, title: b.name.slice(0, MAX_ROW_TITLE) })),
    { id: "none", title: bot.btn.notListed },
  ],
});

const streetPrompt = (): Out => ({ type: "text", body: bot.unkStreetQ });
const unitPrompt = (): Out => ({ type: "text", body: bot.unkUnitQ });
const namePrompt = (): Out => ({ type: "text", body: bot.unkNameQ });

const relationPrompt = (): Out => ({
  type: "buttons",
  body: bot.unkRelationQ,
  buttons: [
    { id: "owner", title: bot.btn.owner },
    { id: "tenant", title: bot.btn.tenant },
    { id: "committee", title: bot.btn.committee },
  ],
});

// ---- Helpers ----

const go = (step: Step, draft: Draft, ...out: Out[]): StepResult => ({ state: { step, draft }, out, effects: [] });

/** Send the question of the current step again. Used for input the step does not expect. */
function reprompt(state: ChatState, ctx?: StepContext): StepResult {
  const prompt: Record<string, (d: Draft) => Out> = {
    menu: menuPrompt, where: wherePrompt, place: placePrompt, type: typePrompt,
    danger: dangerPrompt, details: detailsPrompt, summary: summaryPrompt, fix: fixPrompt,
    consent: consentPrompt, unk_street: streetPrompt, unk_unit: unitPrompt, unk_name: namePrompt,
    unk_relation: relationPrompt, unk_building: () => (ctx ? buildingPrompt(ctx) : menuPrompt()),
  };
  const make = prompt[state.step] ?? menuPrompt;
  return go(state.step, state.draft, make(state.draft));
}

/** Send the resident to a person. Used when the building is unknown or not on the list. */
const toAgent = (draft: Draft): StepResult => ({
  state: { step: "agent", draft },
  out: [{ type: "text", body: bot.unkBuildingNotListed }],
  effects: [{ type: "agent_request" }],
});

/** After consent, an unknown number gives its building: a list for few buildings, a street name for many. */
function askBuilding(draft: Draft, ctx: StepContext, effects: Effect[]): StepResult {
  const intro: Out = { type: "text", body: bot.unkIntro };
  const result = ctx.buildings.length <= MAX_BUILDINGS_IN_LIST
    ? go("unk_building", draft, intro, buildingPrompt(ctx))
    : go("unk_street", draft, intro, streetPrompt());
  return { ...result, effects };
}

const hasContent = (d: Draft) => Boolean(d.text) || d.photoMediaIds.length > 0 || d.audioMediaIds.length > 0;

/** After "type": ask the danger question, or go back to the summary when the resident fixes a field. */
function afterType(draft: Draft): StepResult {
  return draft.danger === undefined ? go("danger", draft, dangerPrompt()) : go("summary", draft, summaryPrompt(draft));
}

/** After "where" or "place": ask the type, or go back to the summary when the resident fixes a field. */
function afterWhere(draft: Draft): StepResult {
  return draft.typeId ? go("summary", draft, summaryPrompt(draft)) : go("type", draft, typePrompt());
}

// ---- Handlers: one per step ----

const onMenu: Handler = (state, input) => {
  if (input.kind === "button" && input.id === "report") return go("where", emptyDraft(), wherePrompt());
  // Tasks 4 and 5 replace this: "check" and "agent" show the menu again for now.
  return go("menu", state.draft, menuPrompt());
};

const onWhere: Handler = (state, input) => {
  if (input.kind !== "button") return reprompt(state);
  if (input.id === "unit") {
    const { place: _place, ...rest } = state.draft;
    return afterWhere({ ...rest, where: "unit" });
  }
  if (input.id === "common") return go("place", { ...state.draft, where: "common" }, placePrompt());
  return reprompt(state);
};

const onPlace: Handler = (state, input) => {
  if (input.kind !== "button" || !PLACES.some((p) => p.id === input.id)) return reprompt(state);
  return afterWhere({ ...state.draft, place: input.id });
};

const onType: Handler = (state, input) => {
  if (input.kind !== "button" || !FAULT_TYPES.some((t) => t.id === input.id)) return reprompt(state);
  return afterType({ ...state.draft, typeId: input.id });
};

const onDanger: Handler = (state, input) => {
  if (input.kind !== "button" || (input.id !== "danger_yes" && input.id !== "danger_no")) return reprompt(state);
  const draft = { ...state.draft, danger: input.id === "danger_yes" };
  return hasContent(draft) ? go("summary", draft, summaryPrompt(draft)) : go("details", draft, detailsPrompt());
};

const onDetails: Handler = (state, input) => {
  let draft = state.draft;
  if (input.kind === "image") {
    draft = { ...draft, photoMediaIds: [...draft.photoMediaIds, input.mediaId] };
    if (input.caption) draft = { ...draft, text: input.caption };
  } else if (input.kind === "audio") {
    draft = { ...draft, audioMediaIds: [...draft.audioMediaIds, input.mediaId] };
  } else if (input.kind === "text") {
    draft = { ...draft, text: input.text };
  } else if (input.kind === "other") {
    return go("details", draft, { type: "text", body: bot.unsupported });
  } else {
    return reprompt(state);
  }

  // A danger word in the text sends the resident back to the danger question, once.
  if (draft.text && hasDangerWord(draft.text) && draft.danger !== true && !draft.dangerRechecked) {
    return go("danger", { ...draft, dangerRechecked: true }, dangerPrompt());
  }
  // Media without text: ask what the problem is, once.
  if (!draft.text && !draft.askedForText) {
    return go("details", { ...draft, askedForText: true }, { type: "text", body: bot.photoOnlyQ });
  }
  return go("summary", draft, summaryPrompt(draft));
};

const onSummary: Handler = (state, input) => {
  if (input.kind === "button" && input.id === "confirm") {
    return { state: null, out: [], effects: [{ type: "create_ticket", draft: state.draft }] };
  }
  if (input.kind === "button" && input.id === "fix") return go("fix", state.draft, fixPrompt());
  return reprompt(state);
};

const onFix: Handler = (state, input) => {
  if (input.kind !== "button") return reprompt(state);
  if (input.id === "where") return go("where", state.draft, wherePrompt());
  if (input.id === "type") return go("type", state.draft, typePrompt());
  if (input.id === "details") {
    const { text: _text, askedForText: _asked, ...rest } = state.draft;
    return go("details", { ...rest, photoMediaIds: [], audioMediaIds: [] }, detailsPrompt());
  }
  return reprompt(state);
};

const onConsent: Handler = (state, input, ctx) => {
  if (input.kind !== "button" || input.id !== "consent") return reprompt(state);
  const effects: Effect[] = [{ type: "save_consent" }];
  if (!ctx.resident.known) return askBuilding(state.draft, ctx, effects);
  return { ...go("menu", emptyDraft(), menuPrompt()), effects };
};

const onBuilding: Handler = (state, input, ctx) => {
  if (input.kind !== "button") return reprompt(state, ctx);
  if (input.id === "none") return toAgent(state.draft);
  if (!ctx.buildings.some((b) => b.id === input.id)) return reprompt(state, ctx);
  return go("unk_unit", { ...state.draft, buildingId: input.id }, unitPrompt());
};

const onStreet: Handler = (state, input, ctx) => {
  if (input.kind !== "text") return reprompt(state);
  const typed = input.text.trim().toLowerCase();
  const matches = typed
    ? ctx.buildings.filter((b) => b.address?.toLowerCase().includes(typed))
    : [];
  // No match or several matches: a person decides.
  if (matches.length !== 1) return toAgent(state.draft);
  return go("unk_unit", { ...state.draft, buildingId: matches[0].id }, unitPrompt());
};

const onUnit: Handler = (state, input) => {
  const unit = input.kind === "text" ? input.text.trim() : "";
  if (!unit) return reprompt(state);
  return go("unk_name", { ...state.draft, unitNumber: unit }, namePrompt());
};

const onName: Handler = (state, input) => {
  const name = input.kind === "text" ? input.text.trim() : "";
  if (!name) return reprompt(state);
  return go("unk_relation", { ...state.draft, name }, relationPrompt());
};

const RELATIONS = ["owner", "tenant", "committee"] as const;

const onRelation: Handler = (state, input, ctx) => {
  const relation = input.kind === "button" ? RELATIONS.find((r) => r === input.id) : undefined;
  if (!relation) return reprompt(state);
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

/** Marked fallback for steps owned by Task 5 (check, agent). */
const showMenu: Handler = (state) => go("menu", emptyDraft(), menuPrompt());

const handlers: Record<Step, Handler> = {
  menu: onMenu,
  where: onWhere,
  place: onPlace,
  type: onType,
  danger: onDanger,
  details: onDetails,
  summary: onSummary,
  fix: onFix,
  consent: onConsent,
  unk_building: onBuilding,
  unk_street: onStreet,
  unk_unit: onUnit,
  unk_name: onName,
  unk_relation: onRelation,
  // Task 5 replaces these entries.
  check: showMenu,
  agent: showMenu,
};

export function nextStep(ctx: StepContext, input: Inbound): StepResult {
  const { state, resident } = ctx;
  // No consent yet: ask for it. An unknown number keeps its first text (not echoed back).
  if (!resident.consented && state?.step !== "consent") {
    const draft = emptyDraft();
    if (!resident.known && input.kind === "text") draft.firstText = input.text;
    return go("consent", draft, consentPrompt());
  }
  if (!state) {
    return resident.known ? go("menu", emptyDraft(), menuPrompt()) : askBuilding(emptyDraft(), ctx, []);
  }
  return handlers[state.step](state, input, ctx);
}
