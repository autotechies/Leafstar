import type { InvArticle } from "./queries";

/** What a buyer can see of this article right now, in the owner's words. */
export type Visibility = "live" | "hidden" | "no-stock" | "private-brand" | "archived";

export function visibilityOf(a: InvArticle): Visibility {
  if (!a.isActive) return "archived";
  if (!a.isPublic) return "hidden";
  if (!a.brandPublic) return "private-brand";
  if (a.totalPieces === 0) return "no-stock";
  return "live";
}

export const visibilityLabel: Record<Visibility, string> = {
  live: "Live on website",
  hidden: "Hidden",
  "no-stock": "Hidden: no stock",
  "private-brand": "Hidden: private brand",
  archived: "Archived",
};

export interface InventoryFilters {
  q: string;
  garment: string;
  brand: string;
  visibility: string;
  stock: string;
}

export const defaultFilters: InventoryFilters = { q: "", garment: "", brand: "", visibility: "", stock: "" };

export function applyFilters(all: InvArticle[], f: InventoryFilters): InvArticle[] {
  const q = f.q.trim().toLowerCase();
  return all.filter((a) => {
    if (q && !`${a.code} ${a.name} ${a.brandName} ${a.fabric ?? ""} ${a.style ?? ""}`.toLowerCase().includes(q)) return false;
    if (f.garment && a.garment !== f.garment) return false;
    if (f.brand && a.brandId !== f.brand) return false;
    const vis = visibilityOf(a);
    if (f.visibility === "live" && vis !== "live") return false;
    if (f.visibility === "hidden" && !["hidden", "no-stock", "private-brand"].includes(vis)) return false;
    if (f.visibility === "archived" ? vis !== "archived" : vis === "archived" && f.visibility !== "") return false;
    if (!f.visibility && vis === "archived") return false; // archived are tucked away unless asked for
    if (f.stock === "out" && a.totalPieces !== 0) return false;
    if (f.stock === "some-out" && a.outCount === 0) return false;
    if (f.stock === "low" && a.lowCount === 0) return false;
    if (f.stock === "in" && a.totalPieces === 0) return false;
    return true;
  });
}

export function filtersFromParams(params: Record<string, string | string[] | undefined>): InventoryFilters {
  const one = (k: string) => {
    const v = params[k];
    return (Array.isArray(v) ? v[0] : v) ?? "";
  };
  return { q: one("q"), garment: one("garment"), brand: one("brand"), visibility: one("visibility"), stock: one("stock") };
}
