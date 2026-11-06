import { apiStaff, jsonError } from "@/lib/api";
import { buildTemplate } from "@/modules/stock/importer";

/** The Excel template for stock import. Staff only. */
export async function GET() {
  if (!(await apiStaff())) return jsonError("Please sign in again.", 401);
  const file = await buildTemplate();
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="leaf-star-stock-template.xlsx"',
      "cache-control": "no-store",
    },
  });
}
