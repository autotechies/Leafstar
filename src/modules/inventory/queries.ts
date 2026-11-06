import "server-only";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { requireStaff } from "@/modules/auth/session";
import type { Photo } from "@/modules/images/types";

export interface InvVariant {
  id: string;
  sku: string;
  size: string;
  sizeOrder: number;
  stock: number;
  lowThreshold: number;
  active: boolean;
}
export interface InvColour {
  id: string;
  name: string;
  code: string;
  hex: string;
  photos: Photo[];
  variants: InvVariant[];
}
export interface InvArticle {
  id: string;
  code: string;
  name: string;
  garment: string;
  style: string | null;
  fabric: string | null;
  pattern: string | null;
  description: string | null;
  moq: number;
  lotSize: number | null;
  isPublic: boolean;
  isActive: boolean;
  isFeatured: boolean;
  updatedAt: string;
  brandId: string;
  brandName: string;
  brandPublic: boolean;
  colours: InvColour[];
  totalPieces: number;
  lowCount: number;
  outCount: number;
  cover: Photo | null;
}
export interface Movement {
  id: string;
  sku: string;
  qty: number;
  reason: string;
  note: string | null;
  batchCode: string | null;
  billId: string | null;
  at: string;
  undoable: boolean;
  undone: boolean;
  isUndo: boolean;
}

const ARTICLE_SELECT =
  "id, code, name, garment, style, fabric, pattern, description, moq, lot_size, is_public, is_active, is_featured, updated_at, brand_id, brands(name, is_public), " +
  "article_colors(id, name, code, hex, sort_order, variants(id, sku, size, size_order, stock, low_stock_threshold, is_active)), " +
  "article_images(id, color_id, thumb_url, medium_url, url, blur_data_url, width, height, sort_order)";

type Row = {
  id: string; code: string; name: string; garment: string; style: string | null; fabric: string | null; pattern: string | null; description: string | null;
  moq: number; lot_size: number | null; is_public: boolean; is_active: boolean; is_featured: boolean; updated_at: string; brand_id: string;
  brands: { name: string; is_public: boolean } | null;
  article_colors: Array<{ id: string; name: string; code: string; hex: string; sort_order: number; variants: Array<{ id: string; sku: string; size: string; size_order: number; stock: number; low_stock_threshold: number; is_active: boolean }> }>;
  article_images: Array<{ id: string; color_id: string | null; thumb_url: string; medium_url: string; url: string; blur_data_url: string | null; width: number | null; height: number | null; sort_order: number }>;
};

function toArticle(r: Row): InvArticle {
  const photo = (i: Row["article_images"][number], alt: string): Photo => ({
    id: i.id, thumbUrl: i.thumb_url, mediumUrl: i.medium_url, url: i.url, blurDataUrl: i.blur_data_url, width: i.width ?? 1600, height: i.height ?? 2000, alt,
  });
  const colours: InvColour[] = [...r.article_colors]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((c) => ({
      id: c.id, name: c.name, code: c.code, hex: c.hex,
      photos: r.article_images.filter((i) => i.color_id === c.id).sort((a, b) => a.sort_order - b.sort_order).map((i, n) => photo(i, `${r.name} in ${c.name}, photo ${n + 1}`)),
      variants: [...c.variants].sort((a, b) => a.size_order - b.size_order).map((v) => ({ id: v.id, sku: v.sku, size: v.size, sizeOrder: v.size_order, stock: v.stock, lowThreshold: v.low_stock_threshold, active: v.is_active })),
    }));
  const all = colours.flatMap((c) => c.variants.filter((v) => v.active));
  const cover = colours.find((c) => c.photos.length)?.photos[0] ?? null;
  return {
    id: r.id, code: r.code, name: r.name, garment: r.garment, style: r.style, fabric: r.fabric, pattern: r.pattern, description: r.description,
    moq: r.moq, lotSize: r.lot_size, isPublic: r.is_public, isActive: r.is_active, isFeatured: r.is_featured, updatedAt: r.updated_at,
    brandId: r.brand_id, brandName: r.brands?.name ?? "", brandPublic: r.brands?.is_public ?? false,
    colours,
    totalPieces: all.reduce((s, v) => s + v.stock, 0),
    lowCount: all.filter((v) => v.stock > 0 && v.stock <= v.lowThreshold).length,
    outCount: all.filter((v) => v.stock === 0).length,
    cover,
  };
}

export async function loadInventory(): Promise<{ articles: InvArticle[]; brands: Array<{ id: string; name: string }> }> {
  await requireStaff(undefined, "/admin/inventory");
  const supabase = await supabaseServer();
  const [articles, brands] = await Promise.all([
    supabase.from("articles").select(ARTICLE_SELECT).order("code").limit(1000),
    supabase.from("brands").select("id, name").order("name"),
  ]);
  if (articles.error) throw new Error(`Inventory could not be loaded: ${articles.error.message}`);
  if (brands.error) throw new Error(`Brands could not be loaded: ${brands.error.message}`);
  return { articles: (articles.data as unknown as Row[]).map(toArticle), brands: brands.data };
}

export async function loadArticle(code: string): Promise<{ article: InvArticle; movements: Movement[]; brands: Array<{ id: string; name: string }> }> {
  await requireStaff(undefined, `/admin/inventory/${encodeURIComponent(code)}`);
  const supabase = await supabaseServer();
  const found = await supabase.from("articles").select(ARTICLE_SELECT).eq("code", code.toUpperCase()).maybeSingle();
  if (found.error) throw new Error(`Article could not be loaded: ${found.error.message}`);
  if (!found.data) notFound();
  const article = toArticle(found.data as unknown as Row);

  const variantIds = article.colours.flatMap((c) => c.variants.map((v) => v.id));
  const skuById = new Map(article.colours.flatMap((c) => c.variants.map((v) => [v.id, v.sku] as const)));
  const [moves, brands] = await Promise.all([
    variantIds.length
      ? supabase
          .from("stock_movements")
          .select("id, variant_id, qty_change, reason, note, bill_id, reverses_movement_id, created_at, batches(code)")
          .in("variant_id", variantIds)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(200)
      : Promise.resolve({ data: [], error: null }),
    supabase.from("brands").select("id, name").order("name"),
  ]);
  if (moves.error) throw new Error(`History could not be loaded: ${moves.error.message}`);
  const rows = moves.data as unknown as Array<{ id: string; variant_id: string; qty_change: number; reason: string; note: string | null; bill_id: string | null; reverses_movement_id: string | null; created_at: string; batches: { code: string } | null }>;
  const reversed = new Set(rows.map((m) => m.reverses_movement_id).filter((x): x is string => Boolean(x)));
  const movements: Movement[] = rows.map((m) => ({
    id: m.id, sku: skuById.get(m.variant_id) ?? "", qty: m.qty_change, reason: m.reason, note: m.note, batchCode: m.batches?.code ?? null, billId: m.bill_id, at: m.created_at,
    undone: reversed.has(m.id),
    isUndo: m.reverses_movement_id !== null,
    undoable: !m.bill_id && !m.reverses_movement_id && !reversed.has(m.id) && ["production", "adjustment", "opening", "return"].includes(m.reason),
  }));
  return { article, movements, brands: brands.data ?? [] };
}
