// Handlers for the fault report: where, place, type, danger, details, summary, fix (spec 6.1, steps 3 to 5).
import { FAULT_TYPES, PLACES, hasDangerWord } from "./catalog";
import { bot } from "./texts";
import { dangerPrompt, detailsPrompt, fixPrompt, go, placePrompt, reprompt, summaryPrompt, typePrompt, wherePrompt } from "./flow-common";
import type { Handler } from "./flow-common";
import type { Draft, StepResult } from "./types";

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

export const onWhere: Handler = (state, input, ctx) => {
  if (input.kind !== "button") return reprompt(state, ctx);
  if (input.id === "unit") {
    const { place: _place, ...rest } = state.draft;
    return afterWhere({ ...rest, where: "unit" });
  }
  if (input.id === "common") return go("place", { ...state.draft, where: "common" }, placePrompt());
  return reprompt(state, ctx);
};

export const onPlace: Handler = (state, input, ctx) => {
  if (input.kind !== "button" || !PLACES.some((p) => p.id === input.id)) return reprompt(state, ctx);
  return afterWhere({ ...state.draft, place: input.id });
};

export const onType: Handler = (state, input, ctx) => {
  if (input.kind !== "button" || !FAULT_TYPES.some((t) => t.id === input.id)) return reprompt(state, ctx);
  return afterType({ ...state.draft, typeId: input.id });
};

export const onDanger: Handler = (state, input, ctx) => {
  if (input.kind !== "button" || (input.id !== "danger_yes" && input.id !== "danger_no")) return reprompt(state, ctx);
  const draft = { ...state.draft, danger: input.id === "danger_yes" };
  return hasContent(draft) ? go("summary", draft, summaryPrompt(draft)) : go("details", draft, detailsPrompt());
};

export const onDetails: Handler = (state, input, ctx) => {
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
    return reprompt(state, ctx);
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

export const onSummary: Handler = (state, input, ctx) => {
  if (input.kind === "button" && input.id === "confirm") {
    // The internal markers stay in the chat state. The ticket does not need them.
    const { askedForText: _asked, dangerRechecked: _rechecked, ...draft } = state.draft;
    return { state: null, out: [], effects: [{ type: "create_ticket", draft }] };
  }
  if (input.kind === "button" && input.id === "fix") return go("fix", state.draft, fixPrompt());
  return reprompt(state, ctx);
};

export const onFix: Handler = (state, input, ctx) => {
  if (input.kind !== "button") return reprompt(state, ctx);
  if (input.id === "where") return go("where", state.draft, wherePrompt());
  if (input.id === "type") return go("type", state.draft, typePrompt());
  if (input.id === "details") {
    const { text: _text, askedForText: _asked, ...rest } = state.draft;
    return go("details", rest, detailsPrompt());
  }
  return reprompt(state, ctx);
};
