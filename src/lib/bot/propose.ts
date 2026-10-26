// Rule-based proposal of the ticket fields. No AI in version 1.
import type { Responsibility, Urgency } from "@/lib/labels";
import { FAULT_TYPES } from "./catalog";

export type Proposed = { title: string; description: string; urgency: Urgency; responsibility: Responsibility };
export type ProposeFn = (input: { typeId: string; where: "unit" | "common"; placeTitle?: string; text?: string }) => Proposed;

const VERY_IMPORTANT_TYPES = ["lift", "plumbing"];

export const proposeFields: ProposeFn = ({ typeId, where, placeTitle, text }) => {
  const type = FAULT_TYPES.find((x) => x.id === typeId) ?? FAULT_TYPES.find((x) => x.id === "other");
  const typeTitle = type?.title ?? "אחר";
  const title = where === "unit" ? `${typeTitle} · בדירה` : placeTitle ? `${typeTitle} · ${placeTitle}` : typeTitle;
  return {
    title,
    description: typeof text === "string" ? text.trim() : "",
    urgency: VERY_IMPORTANT_TYPES.includes(typeId) ? "חשוב מאוד" : "חשוב",
    responsibility: "לא ידוע",
  };
};
