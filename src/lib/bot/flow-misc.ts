// Handlers for the menu, "check a fault", the human agent and "stop" (spec 6.1, steps 4, 6, 7 and 8).
import { bot } from "./texts";
import { MAX_ROW_TITLE, emptyDraft, go, menuPrompt, wherePrompt } from "./flow-common";
import type { Handler } from "./flow-common";
import type { Inbound, Out, StepResult } from "./types";

const MAX_LIST_ROWS = 10;

/** "stop" in any case, or the Hebrew word. */
export const isStop = (input: Inbound): boolean =>
  input.kind === "text" && ["stop", "הפסק"].includes(input.text.trim().toLowerCase());

/** The resident opts out. One confirmation, no state. The handler marks the number as not consented. */
export const stopResult = (): StepResult => ({
  state: null,
  out: [{ type: "text", body: bot.optOut }],
  effects: [{ type: "opt_out" }],
});

const agentResult = (state: Parameters<Handler>[0], hours: Parameters<Handler>[2]["hours"]): StepResult => {
  const out: Out[] = [{ type: "text", body: bot.agentOpen }];
  if (!hours.open) out.push({ type: "text", body: bot.agentClosed(hours.text) });
  return { state: { step: "agent", draft: state.draft }, out, effects: [{ type: "agent_request" }] };
};

const checkResult: Handler = (_state, _input, ctx) => {
  if (ctx.openTickets.length === 0) {
    return go("menu", emptyDraft(), {
      type: "buttons",
      body: bot.noOpenTickets,
      buttons: [{ id: "report", title: bot.btn.report }],
    });
  }
  return go("check", emptyDraft(), {
    type: "list",
    body: bot.openTicketsTitle,
    button: bot.openTicketsButton,
    rows: ctx.openTickets
      .slice(0, MAX_LIST_ROWS)
      .map((t) => ({ id: String(t.number), title: `${t.number} · ${t.typeLabel}`.slice(0, MAX_ROW_TITLE) })),
  });
};

export const onMenu: Handler = (state, input, ctx) => {
  if (input.kind === "button" && input.id === "report") return go("where", emptyDraft(), wherePrompt());
  if (input.kind === "button" && input.id === "check") return checkResult(state, input, ctx);
  if (input.kind === "button" && input.id === "agent") return agentResult(state, ctx.hours);
  return go("menu", emptyDraft(), menuPrompt());
};

export const onCheck: Handler = (_state, input, ctx) => {
  const ticket = input.kind === "button" ? ctx.openTickets.find((t) => String(t.number) === input.id) : undefined;
  if (!ticket) return go("menu", emptyDraft(), menuPrompt());
  return go(
    "menu",
    emptyDraft(),
    { type: "text", body: bot.openTicketLine(ticket.number, ticket.typeLabel, ticket.status, ticket.visit) },
    menuPrompt(),
  );
};

export const onAgent: Handler = (state, input) => {
  // The chat is with a person now. Text, photos and voice go to the inbox: the bot stays quiet.
  if (input.kind === "text" || input.kind === "image" || input.kind === "audio") {
    return { state, out: [], effects: [] };
  }
  return go("menu", emptyDraft(), menuPrompt());
};
