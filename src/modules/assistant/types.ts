/* What the owner's assistant shows. Plain data only. */

export interface BriefingItem { text: string; href?: string }
export interface BriefingSection {
  id: string;
  title: string;
  href: string;
  /** Short sentences, most important first. */
  lines: string[];
  items: BriefingItem[];
  /** True when something here needs the owner (a reply to give, a bill to check), not just "this changed". */
  attention: boolean;
}
export interface Briefing {
  /** When the owner last pressed "Mark as seen" (or 7 days ago the first time). */
  since: string;
  firstTime: boolean;
  /** How many NEW things since then (the number on the button). */
  newCount: number;
  sections: BriefingSection[];
  /** Admin sections with nothing new. */
  quiet: string[];
}
export interface AssistantLink { label: string; href: string }
export interface AssistantReply { reply: string; links: AssistantLink[]; quickReplies: string[]; fallback: boolean }
export interface AssistantTurn { role: "user" | "assistant"; text: string }
export type Counts = Record<
  | "inbox_new" | "inbox_waiting" | "leads_new" | "leads_won" | "leads_lost" | "follow_ups_due" | "buyers_new" | "chat_visitors" | "chat_messages"
  | "questions_new" | "questions_open" | "stock_in" | "stock_out" | "stock_corrections" | "articles_new" | "variants_low" | "variants_out"
  | "bills_drafts" | "bills_applied" | "scans_failed" | "scans_queued",
  number
>;
