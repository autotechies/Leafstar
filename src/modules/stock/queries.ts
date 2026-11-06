import "server-only";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";

export interface ExistingVariant {
  id: string;
  sku: string;
  size: string;
  stock: number;
}
export interface ExistingColour {
  id: string;
  name: string;
  hex: string;
  variants: ExistingVariant[];
}
export interface ExistingArticle {
  id: string;
  code: string;
  name: string;
  garment: string;
  colours: ExistingColour[];
}
export interface AddStockData {
  brands: Array<{ id: string; name: string }>;
  articles: ExistingArticle[];
}

/** Everything the Add Stock page needs, read under the signed-in person's own permissions. */
export async function loadAddStock(): Promise<AddStockData> {
  await requireStaff(undefined, "/admin/stock/add");
  const supabase = await supabaseServer();
  const [brands, articles] = await Promise.all([
    supabase.from("brands").select("id, name").order("name"),
    supabase
      .from("articles")
      .select("id, code, name, garment, article_colors(id, name, hex, sort_order, variants(id, sku, size, size_order, stock, is_active))")
      .eq("is_active", true)
      .order("code"),
  ]);
  if (brands.error) throw new Error(`Brands could not be loaded: ${brands.error.message}`);
  if (articles.error) throw new Error(`Articles could not be loaded: ${articles.error.message}`);

  return {
    brands: brands.data,
    articles: articles.data.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      garment: a.garment,
      colours: [...a.article_colors]
        .sort((x, y) => x.sort_order - y.sort_order)
        .map((c) => ({
          id: c.id,
          name: c.name,
          hex: c.hex,
          variants: [...c.variants]
            .filter((v) => v.is_active)
            .sort((x, y) => x.size_order - y.size_order)
            .map((v) => ({ id: v.id, sku: v.sku, size: v.size, stock: v.stock })),
        })),
    })),
  };
}
