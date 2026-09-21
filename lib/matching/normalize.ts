import { findKnownBrand } from "@/data/knownBrands";
import type { NormalizedProduct, NormalizedQuantity, RawProduct } from "@/types";

// Hard variants are mutually exclusive, never-interchangeable product lines —
// a match must never merge across these (Coke vs Coke Zero).
export const HARD_VARIANT_KEYWORDS = new Set(["zero", "diet", "sugar free", "no sugar"]);

// Soft variants are descriptive adjectives platforms inconsistently include
// for what's otherwise the default product (e.g. "Amul Taaza Milk" on one
// platform vs "Amul Taaza Toned Milk" on another, same real item). Missing
// on one side shouldn't block a match; conflicting on both sides should.
const SOFT_VARIANT_KEYWORDS = [
  "toned",
  "full cream",
  "double toned",
  "skimmed",
  "homogenised",
  "homogenized",
  "lite",
  "light",
  "classic",
  "spicy",
  "masala",
];

const VARIANT_KEYWORDS = [...HARD_VARIANT_KEYWORDS, ...SOFT_VARIANT_KEYWORDS];

const STOPWORDS = new Set([
  "the",
  "of",
  "pack",
  "pkt",
  "combo",
  "pouch",
  "bottle",
  "jar",
  "with",
  "a",
  "an",
]);

// Real catalogues use abbreviations beyond the obvious ones — "ltr" (not
// just "l"/"litre") showed up as the dominant volume unit against the live
// QuickCommerce API, and would have silently broken quantity matching for
// nearly every milk product if left out.
const QUANTITY_REGEX = /(\d+(?:\.\d+)?)\s*(ltrs?|litres?|l|ml|kgs?|gms?|grams?|g|pcs?|pieces?)\b/i;

function unitToBase(value: number, unit: string): { value: number; unit: NormalizedQuantity["unit"] } {
  const u = unit.toLowerCase();
  if (u === "l" || u === "ltr" || u === "ltrs" || u === "litre" || u === "litres") {
    return { value: value * 1000, unit: "ml" };
  }
  if (u === "ml") return { value, unit: "ml" };
  if (u === "kg" || u === "kgs") return { value: value * 1000, unit: "g" };
  if (u === "g" || u === "gm" || u === "gms" || u === "gram" || u === "grams") return { value, unit: "g" };
  return { value, unit: "pcs" };
}

const UNIT_ALT = "ltrs?|litres?|l|ml|kgs?|gms?|grams?|g|pcs?|pieces?";
// Multipacks ("1 ltr x 12", "2 x 200 ml") state a per-unit size and a count
// separately. Treating the per-unit size alone as the product's quantity
// would make a 12-unit wholesale case look identical to a single 1L retail
// pack — comparing them as the same product would badly misstate price.
const MULTIPACK_UNIT_FIRST = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${UNIT_ALT})\\s*[x×]\\s*(\\d+)`, "i");
const MULTIPACK_COUNT_FIRST = new RegExp(`(\\d+)\\s*[x×]\\s*(\\d+(?:\\.\\d+)?)\\s*(${UNIT_ALT})`, "i");

export function parseQuantity(quantityStr: string | null, name: string): NormalizedQuantity | null {
  const source = quantityStr || name;

  const unitFirst = source.match(MULTIPACK_UNIT_FIRST);
  if (unitFirst) {
    const perUnit = parseFloat(unitFirst[1]);
    const count = parseInt(unitFirst[3], 10);
    const { value, unit } = unitToBase(perUnit * count, unitFirst[2]);
    return { value, unit, display: quantityStr || source };
  }

  const countFirst = source.match(MULTIPACK_COUNT_FIRST);
  if (countFirst) {
    const count = parseInt(countFirst[1], 10);
    const perUnit = parseFloat(countFirst[2]);
    const { value, unit } = unitToBase(perUnit * count, countFirst[3]);
    return { value, unit, display: quantityStr || source };
  }

  const match = source.match(QUANTITY_REGEX);
  if (!match) return null;
  const rawValue = parseFloat(match[1]);
  const { value, unit } = unitToBase(rawValue, match[2]);
  const display = quantityStr || `${match[1]} ${match[2]}`;
  return { value, unit, display };
}

export function extractVariantTags(name: string): string[] {
  const lower = name.toLowerCase();
  return VARIANT_KEYWORDS.filter((kw) => lower.includes(kw)).sort();
}

export function normalizeBrand(brand: string | null, name: string): string | null {
  if (brand && brand.trim()) return brand.trim();
  return findKnownBrand(name);
}

/** Descriptive tokens left after stripping brand, quantity and stopwords —
 * used to sanity-check that two products are actually the same thing, not
 * just coincidentally sharing a brand and quantity. */
export function coreTokens(product: NormalizedProduct): Set<string> {
  let text = product.name.toLowerCase();
  if (product.normalizedBrand) {
    text = text.replace(product.normalizedBrand.toLowerCase(), "");
  }
  text = text.replace(QUANTITY_REGEX, "");
  const tokens = text
    .split(/[^a-z0-9]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
  return new Set(tokens);
}

export function normalizeProduct(raw: RawProduct): NormalizedProduct {
  const normalizedQuantity = parseQuantity(raw.quantity, raw.name);
  return {
    ...raw,
    normalizedBrand: normalizeBrand(raw.brand, raw.name),
    normalizedQuantity,
    variantTags: extractVariantTags(raw.name),
  };
}
