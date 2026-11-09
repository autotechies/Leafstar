import type { Photo } from "@/modules/images/types";

export const STAGES = ["new", "contacted", "quoted", "negotiation", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export const stageLabel: Record<Stage, string> = { new: "New", contacted: "Contacted", quoted: "Quoted", negotiation: "Negotiation", won: "Won", lost: "Lost" };

export interface LeadCard {
  id: string;
  name: string;
  businessName: string | null;
  phone: string;
  city: string | null;
  source: string;
  stage: Stage;
  quotedAmount: number | null;
  nextFollowUp: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
}

export interface LeadItemRow { id: string; articleCode: string; articleName: string; colour: string | null; quantity: number | null; photos: Photo[] }
export interface ActivityRow { id: string; kind: string; body: string | null; createdAt: string }
export interface LeadDetail extends LeadCard {
  instagram: string | null;
  message: string | null;
  lostReason: string | null;
  contactId: string | null;
  items: LeadItemRow[];
  activities: ActivityRow[];
  /** The latest messages from the website assistant when this person chatted with the same phone number. */
  chat: { visitorId: string; visits: number; messages: Array<{ id: string; role: "user" | "assistant"; content: string; createdAt: string }> } | null;
}

export interface BuyerRow {
  id: string;
  name: string;
  businessName: string | null;
  phone: string | null;
  email: string | null;
  instagram: string | null;
  city: string | null;
  gstin: string | null;
  creditLimit: number | null;
  paymentTermsDays: number | null;
  notes: string | null;
  totalPieces: number;
  totalValue: number | null;
  billCount: number;
  lastPurchase: string | null;
  bills: Array<{ id: string; billNumber: string | null; billDate: string | null; amount: number | null; pieces: number }>;
}

export const sourceLabel: Record<string, string> = {
  request_price: "Request price", enquiry_list: "Enquiry list", chatbot: "Chat", contact_form: "Contact form", call_click: "Call back", whatsapp: "WhatsApp", manual: "Added by hand",
};
