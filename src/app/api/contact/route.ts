import { handleLead } from "@/modules/site/leads";
import { contactSchema } from "@/modules/site/schemas";

/* The Contact page form. */

export async function POST(request: Request) {
  return handleLead(request, {
    route: "contact",
    schema: contactSchema,
    toLead: (input) => ({
      name: input.name, phone: input.phone, source: "contact_form",
      message: input.email ? `${input.message}\n\nEmail: ${input.email}` : input.message,
    }),
  });
}
