import { SIZE_OPTIONS } from "@/modules/stock/constants";

const SINGLE_SIZES = new Set<string>(SIZE_OPTIONS);
const MIXED_COLOUR = /assort|mixed|multi|various|all\s+colou?rs?|colou?rs?\s+mix/i;

/**
 * A bill line is "assorted" when it does not name ONE size and ONE colour, for example
 * "Sizes: S-XXL, Assorted Colours". The bill cannot say which pieces to deduct, so the owner splits the line
 * across the colours and sizes that were really sent. A size such as "S-XXL" is a range, not a size.
 */
export function isAssortedLine(line: { size: string; colour: string; name: string }): boolean {
  const sizeUnclear = !SINGLE_SIZES.has(line.size.trim().toUpperCase());
  const colourUnclear = MIXED_COLOUR.test(`${line.colour} ${line.name}`);
  return sizeUnclear || colourUnclear;
}
