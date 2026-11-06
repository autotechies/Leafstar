/** Turns a database error into a sentence the owner can act on. Unknown errors stay generic (never leak internals). */
export function friendlyStockError(message: string | undefined): string {
  const m = message ?? "";
  if (/articles_code_key|duplicate key.*articles/i.test(m)) return "An article with this code already exists. Use another code or press Auto-generate.";
  if (/batches_code_key|duplicate key.*batches/i.test(m)) return "This batch was already saved. Reload the page before adding more.";
  if (/article_colors_article_id_code_key/i.test(m)) return "Two colours use the same 3-letter code.";
  if (/article_colors_article_id_name_key/i.test(m)) return "Two colours have the same name.";
  if (/variants_sku_key|duplicate key.*sku/i.test(m)) return "These sizes or colours already exist for this article.";
  if (/brands/i.test(m) && /foreign key/i.test(m)) return "Choose a brand from the list.";
  const known = [
    "Every colour needs at least one photo",
    "Add at least one colour",
    "Choose at least one size",
    "Enter at least one quantity",
    "Quantities must be positive",
    "Stock cannot be negative",
    "already undone",
    "belongs to a bill",
    "Nothing to undo",
    "Stock entry not found",
    "Not allowed",
    "Create the article first",
    "Add at least one photo",
    "Colour not found",
    "Article not found",
    "Choose a size",
  ];
  const hit = known.find((k) => m.includes(k));
  if (hit) return m.replace(/^.*?(?=[A-Z])/, "").split("\n")[0];
  if (/stock_check|violates check constraint.*stock/i.test(m)) return "That would take stock below zero, so nothing was changed.";
  return "That couldn't be saved. Check your connection and try again.";
}
