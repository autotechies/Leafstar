export type InboxKind = "callback_request" | "call_tap" | "chat" | "request_price" | "contact_form" | "missed_call" | "whatsapp";
export interface InboxItem { id: string; kind: InboxKind; preview: string | null; createdAt: string; articleCode: string | null }
export interface InboxContact { key: string; name: string | null; phone: string | null; items: InboxItem[]; oldestAt: string; latestAt: string; leadId: string | null }
export interface HandledRow { id: string; kind: InboxKind; name: string | null; phone: string | null; preview: string | null; handledAt: string; via: string | null; note: string | null }
export interface InboxData { open: InboxContact[]; handled: HandledRow[]; vapidPublicKey: string | null }

export const kindLabel: Record<InboxKind, string> = {
  callback_request: "Asked for a call back",
  call_tap: "Tapped Call",
  chat: "Chatted with the assistant",
  request_price: "Asked for a price",
  contact_form: "Sent a message",
  missed_call: "Missed call",
  whatsapp: "WhatsApp",
};
