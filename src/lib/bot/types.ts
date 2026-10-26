// Shared types for the WhatsApp bot.

export type Inbound =
  | { kind: "text"; text: string } | { kind: "button"; id: string }
  | { kind: "image"; mediaId: string; caption?: string } | { kind: "audio"; mediaId: string } | { kind: "other" };
export type InboundMessage = { waMessageId: string; phone: string; at: string; content: Inbound };
export type Out =
  | { type: "text"; body: string }
  | { type: "buttons"; body: string; buttons: { id: string; title: string }[] }
  | { type: "list"; body: string; button: string; rows: { id: string; title: string }[] }
  | { type: "template"; name: TemplateName; params: string[] };
export type TemplateName = "ticket_assigned" | "ticket_visit" | "ticket_done" | "ticket_info";
export type Step = "consent" | "menu" | "where" | "place" | "type" | "danger" | "details" | "summary" | "fix"
  | "unk_building" | "unk_street" | "unk_unit" | "unk_name" | "unk_relation" | "check" | "agent";
export type Draft = { where?: "unit" | "common"; place?: string; typeId?: string; danger?: boolean; text?: string;
  photoMediaIds: string[]; audioMediaIds: string[]; buildingId?: string; unitNumber?: string; name?: string; relation?: "owner" | "tenant" | "committee"; firstText?: string };
export type ChatState = { step: Step; draft: Draft };
export type Effect =
  | { type: "save_consent" } | { type: "opt_out" } | { type: "register_unknown"; draft: Draft }
  | { type: "create_ticket"; draft: Draft } | { type: "agent_request" };
export type StepContext = {
  state: ChatState | null; now: Date;
  resident: { known: boolean; consented: boolean; name?: string };
  buildings: { id: string; name: string; address: string | null }[];
  openTickets: { number: number; typeLabel: string; status: string; visit: string | null }[];
  hours: { open: boolean; text: string }; emergencyNumber: string | null;
};
export type StepResult = { state: ChatState | null; out: Out[]; effects: Effect[] };
