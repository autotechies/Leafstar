import { handleLead } from "@/modules/site/leads";
import { callbackSchema, requestSchema } from "@/modules/site/schemas";
import { z } from "zod";

/* Request Price (one article) and "call me back" (the call sheet). */

const body = z.union([
  requestSchema.extend({ kind: z.literal("request_price") }),
  callbackSchema.extend({ kind: z.literal("callback") }),
]);

export async function POST(request: Request) {
  return handleLead(request, {
    route: "leads",
    schema: body,
    toLead: (input) =>
      input.kind === "callback"
        ? { name: input.name, phone: input.phone, instagram: input.instagram, source: "call_click", message: "Asked us to call back (call sheet)." }
        : {
            name: input.name, phone: input.phone, business_name: input.businessName, city: input.city, instagram: input.instagram,
            source: "request_price", message: input.note, quantity: input.quantity,
            items: input.items.map((i) => ({ article_id: i.articleId, color_id: i.colourId, quantity: i.quantity ?? input.quantity })),
          },
  });
}
