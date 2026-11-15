import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { generate } from "@/modules/ai/gemini";
import type { BuyerDossier, CustomerAiProfile, CustomerTier } from "./types";

const EVALUATION_SYSTEM_PROMPT = `
You are the Lead Merchandising & Commercial Analyst for Leaf Star, a premium clothing manufacturer that produces shirts and pants and sells wholesale in bulk lots (MOQs of 50/100 pieces) directly to retail shops and distributors.

Your objective:
Thoroughly evaluate a wholesale customer based on their complete transaction history, purchased articles, fabric and color choices, lot sizes, billing values, payment terms, and inquiries.

Classification Tiers:
- 'vip_wholesaler': High-volume repeat buyer (large lot sizes, frequent orders, substantial revenue).
- 'active_retailer': Steady, reliable buyer taking 50-100 pcs MOQ lots on a regular seasonal cycle.
- 'sample_buyer': Has placed only 1 trial order or requested initial lots; needs conversion and follow-up.
- 'at_risk': Formerly active buyer who has not placed an order in 60+ days or missed their usual buying cycle.
- 'payment_risk': High outstanding balance, delayed payments, high dispute/return tendency, or exceeding credit terms.
- 'new_prospect': Inquiry/lead stage with zero confirmed billing invoices so far.

Return a valid JSON object matching the requested schema. Be concise, commercial, and actionable for an apparel factory owner.
`.trim();

const EVALUATION_JSON_SCHEMA = {
  type: "object",
  properties: {
    tier: {
      type: "string",
      enum: ["vip_wholesaler", "active_retailer", "sample_buyer", "at_risk", "payment_risk", "new_prospect"],
    },
    summary: {
      type: "string",
      description: "2-3 concise sentences summarizing this customer's wholesale relationship, volume scale, and buying tendencies.",
    },
    buyingDna: {
      type: "object",
      properties: {
        preferredGarments: { type: "array", items: { type: "string" } },
        preferredFabrics: { type: "array", items: { type: "string" } },
        preferredColors: { type: "array", items: { type: "string" } },
        preferredSizes: { type: "array", items: { type: "string" } },
        avgLotSize: { type: ["number", "null"] },
      },
      required: ["preferredGarments", "preferredFabrics", "preferredColors", "preferredSizes"],
    },
    recommendedAction: {
      type: "string",
      description: "Concrete, actionable next step for the sales representative or factory owner.",
    },
    riskAssessment: {
      type: "string",
      description: "Evaluation of churn risk, credit risk, or seasonal inactivity.",
    },
    tags: {
      type: "array",
      items: { type: "string" },
      description: "Up to 5 relevant tags like 'festive-buyer', 'prompt-payer', 'heavy-linen', 'sample-order', 'credit-watch'.",
    },
  },
  required: ["tier", "summary", "buyingDna", "recommendedAction", "riskAssessment", "tags"],
};

export async function evaluateCustomerAi(
  dossier: BuyerDossier,
): Promise<{ tier: CustomerTier; profile: CustomerAiProfile; tags: string[] }> {
  const supabase = await supabaseServer();

  const customerDataText = JSON.stringify({
    name: dossier.name,
    businessName: dossier.businessName,
    city: dossier.city,
    gstin: dossier.gstin,
    creditLimit: dossier.creditLimit,
    paymentTermsDays: dossier.paymentTermsDays,
    notes: dossier.notes,
    currentTier: dossier.customerTier,
    totalPiecesBought: dossier.totalPieces,
    totalBilledValueRupees: dossier.totalValue,
    billCount: dossier.billCount,
    averageOrderValueRupees: dossier.averageOrderValue,
    averageLotSizePieces: dossier.averageLotSize,
    daysSinceLastPurchase: dossier.daysSinceLastPurchase,
    purchasedArticles: dossier.purchasedArticles.map((a) => ({
      code: a.articleCode,
      name: a.articleName,
      garment: a.garment,
      fabric: a.fabric,
      totalPieces: a.totalPieces,
      totalAmount: a.totalAmount,
      variantsBought: a.variants,
    })),
    recentTimelineEvents: dossier.timeline.slice(0, 10).map((t) => ({
      type: t.type,
      title: t.title,
      timestamp: t.timestamp,
      description: t.description,
    })),
  });

  const prompt = `Analyze this wholesale garment customer's records:\n\n${customerDataText}`;

  const result = await generate({
    feature: "other",
    system: EVALUATION_SYSTEM_PROMPT,
    parts: [{ text: prompt }],
    jsonSchema: EVALUATION_JSON_SCHEMA,
    temperature: 0.2,
    timeoutMs: 40_000,
  });

  const parsed = JSON.parse(result.text) as {
    tier: CustomerTier;
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
    tags: string[];
  };

  const profile: CustomerAiProfile = {
    summary: parsed.summary,
    buyingDna: parsed.buyingDna,
    recommendedAction: parsed.recommendedAction,
    riskAssessment: parsed.riskAssessment,
    analyzedAt: new Date().toISOString(),
  };

  // Persist to contacts table: try RPC save_customer_ai_profile, fallback to direct update
  const rpcRes = await (supabase as unknown as { rpc: (name: string, args: unknown) => Promise<{ error: unknown; data: unknown }> }).rpc("save_customer_ai_profile", {
    p_contact_id: dossier.id,
    p_tier: parsed.tier,
    p_profile: profile,
    p_tags: parsed.tags,
  });

  if (rpcRes.error) {
    // Direct update fallback
    await supabase
      .from("contacts")
      .update({
        customer_tier: parsed.tier,
        ai_profile: profile as unknown as string,
        tags: parsed.tags,
        last_evaluated_at: new Date().toISOString(),
      })
      .eq("id", dossier.id);
  }

  return { tier: parsed.tier, profile, tags: parsed.tags };
}
