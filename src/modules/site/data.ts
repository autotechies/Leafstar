import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database";
import { hasPublicSupabaseEnv, publicEnv } from "@/lib/env";
import type { Photo } from "@/modules/images/types";

/*
  What the public website may read (AGENTS.md §7): ONLY the `public_catalog` and `public_settings` views,
  with the anon key. The views already hide prices, exact stock, hidden brands and out-of-stock articles;
  nothing here re-implements or loosens that. Failures never throw: pages show an honest message instead.
*/

export interface PublicColour {
  id: string;
  name: string;
  hex: string;
  sizes: string[];
  photos: Photo[];
}

export interface PublicArticle {
  id: string;
  code: string;
  name: string;
  garment: string;
  category: string;
  style: string | null;
  brand: string;
  fabric: string | null;
  pattern: string | null;
  description: string | null;
  moq: number;
  lotSize: number | null;
  featured: boolean;
  createdAt: string;
  sizes: string[];
  colours: PublicColour[];
  /** Photos that belong to no colour. */
  photos: Photo[];
  availability: "in_stock" | "low_stock";
}

export interface PublicSettings {
  businessName: string;
  tagline: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  instagram: string | null;
}

function anonClient() {
  const env = publicEnv();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

type RawPhoto = { thumb: string; medium: string; large: string; blur: string | null; w: number | null; h: number | null };

function toPhotos(raw: Json | null, alt: string): Photo[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown as RawPhoto[])
    .filter((p) => p && p.medium && p.large)
    .map((p, i) => ({
      id: `${p.large}#${i}`,
      thumbUrl: p.thumb || p.medium,
      mediumUrl: p.medium,
      url: p.large,
      blurDataUrl: p.blur,
      width: p.w ?? 1600,
      height: p.h ?? 2000,
      alt,
    }));
}

type CatalogRow = Database["public"]["Views"]["public_catalog"]["Row"];

function toArticle(row: CatalogRow): PublicArticle {
  const colours = Array.isArray(row.colors)
    ? (row.colors as unknown as Array<{ id: string; name: string; hex: string; sizes: string[]; images: Json }>).map((c) => ({
        id: c.id,
        name: c.name,
        hex: c.hex,
        sizes: c.sizes ?? [],
        photos: toPhotos(c.images, `${row.name} in ${c.name}`),
      }))
    : [];
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    garment: row.garment,
    category: row.category,
    style: row.style,
    brand: row.brand,
    fabric: row.fabric,
    pattern: row.pattern,
    description: row.description,
    moq: row.moq,
    lotSize: row.lot_size,
    featured: row.is_featured,
    createdAt: row.created_at,
    sizes: Array.isArray(row.sizes) ? (row.sizes as string[]) : [],
    colours,
    photos: toPhotos(row.images, row.name),
    availability: row.availability === "low_stock" ? "low_stock" : "in_stock",
  };
}

/** The photos to show for an article, preferring the given colour. */
export function photosFor(article: PublicArticle, colourIndex = 0): Photo[] {
  const own = article.colours[colourIndex]?.photos ?? [];
  if (own.length > 0) return own;
  if (article.photos.length > 0) return article.photos;
  return article.colours.flatMap((c) => c.photos);
}

export async function loadCatalog(): Promise<{ articles: PublicArticle[]; failed: boolean }> {
  if (!hasPublicSupabaseEnv()) return { articles: [], failed: false };
  try {
    const { data, error } = await anonClient().from("public_catalog").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    return { articles: (data ?? []).map(toArticle), failed: false };
  } catch (error) {
    console.error("[site] catalog read failed", error);
    return { articles: [], failed: true };
  }
}

export async function loadArticle(code: string): Promise<{ article: PublicArticle | null; related: PublicArticle[]; failed: boolean }> {
  const { articles, failed } = await loadCatalog();
  const article = articles.find((a) => a.code.toLowerCase() === code.toLowerCase()) ?? null;
  const related = article ? articles.filter((a) => a.id !== article.id && a.garment === article.garment).slice(0, 4) : [];
  return { article, related, failed };
}

export async function loadSettings(): Promise<PublicSettings | null> {
  if (!hasPublicSupabaseEnv()) return null;
  try {
    const { data, error } = await anonClient().from("public_settings").select("*").maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      businessName: data.business_name ?? "Leaf Star",
      tagline: data.tagline ?? "Premium wear. Trusted quality.",
      phone: data.phone,
      whatsapp: data.whatsapp,
      email: data.email,
      address: data.address,
      city: data.city,
      instagram: data.instagram,
    };
  } catch (error) {
    console.error("[site] settings read failed", error);
    return null;
  }
}
