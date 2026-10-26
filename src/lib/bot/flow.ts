// Chat flow for the WhatsApp bot. Pure function: state and input in, state, messages and effects out.
// This file handles the known, consented resident who reports a fault (spec 6.1, steps 3 to 5).
import { FAULT_TYPES, PLACES, hasDangerWord } from "./catalog";
import { bot } from "./texts";
import type { ChatState, Draft, Inbound, Out, Step, StepContext, StepResult } from "./types";

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

// ---- Helpers ----

const go = (step: Step, draft: Draft, ...out: Out[]): StepResult => ({ state: { step, draft }, out, effects: [] });

/** Send the question of the current step again. Used for input the step does not expect. */
function reprompt(state: ChatState): StepResult {
  const prompt: Record<string, (d: Draft) => Out> = {
    menu: menuPrompt, where: wherePrompt, place: placePrompt, type: typePrompt,
    danger: dangerPrompt, details: detailsPrompt, summary: summaryPrompt, fix: fixPrompt,
  };
  const make = prompt[state.step] ?? menuPrompt;
  return go(state.step, state.draft, make(state.draft));
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

/** Marked fallback for steps owned by Tasks 4 and 5 (consent, unknown number, check, agent). */
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
  // Tasks 4 and 5 replace these entries.
  consent: showMenu,
  check: showMenu,
  agent: showMenu,
  unk_building: showMenu,
  unk_street: showMenu,
  unk_unit: showMenu,
  unk_name: showMenu,
  unk_relation: showMenu,
};

export function nextStep(ctx: StepContext, input: Inbound): StepResult {
  // Tasks 4 and 5 replace this fallback for unknown or not consented residents.
  if (!ctx.resident.known || !ctx.resident.consented || !ctx.state) {
    return go("menu", emptyDraft(), menuPrompt());
  }
  return handlers[ctx.state.step](ctx.state, input, ctx);
}
