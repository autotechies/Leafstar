import type { Photo } from "@/modules/images/types";

export const STAGES = ["new", "contacted", "quoted", "negotiation", "won", "lost"] as const;
export type Stage = (typeof STAGES)[number];
export const stageLabel: Record<Stage, string> = { new: "New", contacted: "Contacted", quoted: "Quoted", negotiation: "Negotiation", won: "Won", lost: "Lost" };

export const CUSTOMER_TIERS = ["vip_wholesaler", "active_retailer", "sample_buyer", "at_risk", "payment_risk", "new_prospect"] as const;
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];

export const tierLabel: Record<CustomerTier, string> = {
  vip_wholesaler: "VIP Wholesaler",
  active_retailer: "Active Retailer",
  sample_buyer: "Sample / Trial",
  at_risk: "At-Risk / Inactive",
  payment_risk: "Payment Risk",
  new_prospect: "New Prospect",
};

export const tierTone: Record<CustomerTier, "success" | "warning" | "danger" | "neutral"> = {
  vip_wholesaler: "success",
  active_retailer: "neutral",
  sample_buyer: "neutral",
  at_risk: "warning",
  payment_risk: "danger",
  new_prospect: "neutral",
};

export interface CustomerAiProfile {
  summary: string;
  buyingDna: {
    preferredGarments: string[];
    preferredFabrics: string[];
    preferredColors: string[];
    preferredSizes: string[];
    avgLotSize: number | null;
  };
  recommendedAction: string;
  riskAssessment: string;
  analyzedAt: string;
}

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
  customerTier: CustomerTier;
  tags: string[];
  aiProfile: CustomerAiProfile | null;
  lastEvaluatedAt: string | null;
  totalPieces: number;
  totalValue: number | null;
  billCount: number;
  lastPurchase: string | null;
  bills: Array<{ id: string; billNumber: string | null; billDate: string | null; amount: number | null; pieces: number }>;
}

export interface BuyerPurchasedArticle {
  articleId: string;
  articleCode: string;
  articleName: string;
  garment: string;
  fabric: string | null;
  coverThumb: string | null;
  photos?: Photo[];
  totalPieces: number;
  totalAmount: number | null;
  variants: Array<{ sku: string; color: string; size: string; qty: number }>;
  firstBoughtAt: string;
  lastBoughtAt: string;
}

export interface BuyerTimelineItem {
  id: string;
  type: "bill" | "lead" | "activity" | "chat" | "return";
  title: string;
  timestamp: string;
  description: string | null;
  meta?: Record<string, unknown>;
}

export interface BuyerDossier extends BuyerRow {
  averageOrderValue: number | null;
  averageLotSize: number | null;
  returnedPieces: number;
  daysSinceLastPurchase: number | null;
  purchasedArticles: BuyerPurchasedArticle[];
  timeline: BuyerTimelineItem[];
  leads: LeadCard[];
}

export const sourceLabel: Record<string, string> = {
  request_price: "Request price", enquiry_list: "Enquiry list", chatbot: "Chat", contact_form: "Contact form", call_click: "Call back", whatsapp: "WhatsApp", manual: "Added by hand",
};
