// Chat flow for the WhatsApp bot. Pure function: state and input in, state, messages and effects out.
// This file routes the input to the handler of the current step. The handlers live in flow-*.ts.
import { askBuilding, consentPrompt, emptyDraft, go, menuPrompt } from "./flow-common";
import type { Handler } from "./flow-common";
import { onDanger, onDetails, onFix, onPlace, onSummary, onType, onWhere } from "./flow-report";
import { onAgent, onCheck, onMenu, stopResult, isStop } from "./flow-misc";
import { onBuilding, onConsent, onName, onRelation, onStreet, onUnit } from "./flow-unknown";
import type { Inbound, Step, StepContext, StepResult } from "./types";

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
  check: onCheck,
  agent: onAgent,
};

// Steps where an unsupported message (sticker, location, video) ends the flow with the menu.
// "details" answers it with a hint, and the unknown-number steps ask the same question again.
const MENU_ON_OTHER: Step[] = ["menu", "where", "place", "type", "danger", "summary", "fix", "check", "agent"];

export function nextStep(ctx: StepContext, input: Inbound): StepResult {
  const { state, resident } = ctx;
  // "stop" works in every step, also before consent.
  if (isStop(input)) return stopResult();
  // No consent yet: ask for it. An unknown number keeps its first text (not echoed back).
  if (!resident.consented && state?.step !== "consent") {
    const draft = emptyDraft();
    if (!resident.known && input.kind === "text") draft.firstText = input.text;
    return go("consent", draft, consentPrompt());
  }
  // No state (new chat or time-out, the handler passes null): start at the menu.
  if (!state) {
    return resident.known ? go("menu", emptyDraft(), menuPrompt()) : askBuilding(emptyDraft(), ctx, []);
  }
  if (input.kind === "other" && MENU_ON_OTHER.includes(state.step)) return go("menu", emptyDraft(), menuPrompt());
  return handlers[state.step](state, input, ctx);
}
