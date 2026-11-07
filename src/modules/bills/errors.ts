/** Turns a database error from a bill action into a sentence the owner can act on. */
export function friendlyBillError(message: string | undefined): string {
  const m = message ?? "";
  if (/bills_unique_number/i.test(m)) return "A bill with this number and date has already been applied. Check that it is not a duplicate.";
  if (/bills_unique_file/i.test(m)) return "This exact file has already been applied.";
  if (/stock_check|variants_stock/i.test(m)) return "This would take some stock below zero, so nothing was changed. Check the quantities.";
  if (/not matched to a product/i.test(m)) return "Some lines are not matched to an article yet. Choose one for each.";
  if (/no items/i.test(m)) return "Add at least one line to the bill.";
  if (/already (applied|undone)/i.test(m)) return "This bill was already applied or undone. Reload the page.";
  if (/at least 1/i.test(m)) return "Every line needs a quantity of at least 1.";
  if (/Only an applied bill/i.test(m)) return "Only an applied bill can be undone.";
  if (/Not allowed/i.test(m)) return "You do not have permission to do that.";
  return "That could not be saved. Check your connection and try again.";
}
