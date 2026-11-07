import { handleLead } from "@/modules/site/leads";
import { requestSchema } from "@/modules/site/schemas";

/* The enquiry list: several articles, one request. */

export async function POST(request: Request) {
  return handleLead(request, {
    route: "enquiry",
    schema: requestSchema.refine((v) => v.items.length > 0, "Add at least one article to your list"),
    toLead: (input) => ({
      name: input.name, phone: input.phone, business_name: input.businessName, city: input.city, instagram: input.instagram,
      source: "enquiry_list", message: input.note, quantity: input.quantity,
      items: input.items.map((i) => ({ article_id: i.articleId, color_id: i.colourId, quantity: i.quantity })),
    }),
  });
}
