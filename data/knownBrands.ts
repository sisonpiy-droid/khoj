// A brand-name lexicon used only to help the matching layer normalize
// products deterministically (extracting a brand when a provider doesn't
// supply one, and detecting brand mentions in the user's query). This is not
// a product catalogue — no prices, SKUs, or availability live here.
//
// Some brands are commonly referred to by a nickname that never appears in
// the official product name ("Coke" for "Coca-Cola"). Those are mapped to
// the canonical name so brand comparison doesn't treat them as different
// brands.

const CANONICAL_BRANDS = [
  "Amul",
  "Mother Dairy",
  "Britannia",
  "Nestle",
  "Coca-Cola",
  "Pepsi",
  "Aashirvaad",
  "Tata",
  "India Gate",
  "Fortune",
  "Bambino",
  "Parle",
  "ITC",
  "Haldiram's",
  "Kissan",
  "Kwality Walls",
  "Cadbury",
  "MTR",
  "Everest",
  "MDH",
  "Real",
  "Tropicana",
  "Dabur",
  "Patanjali",
  "Saffola",
  "Vim",
  "Surf Excel",
  "Colgate",
  "Lays",
  "Bingo",
];

const BRAND_ALIASES: Record<string, string> = {
  coke: "Coca-Cola",
  "coca cola": "Coca-Cola",
  // Maggi is a Nestle product line, not a separate manufacturer — treat a
  // bare "Maggi" search as naming the same brand as "Nestle" so it doesn't
  // get penalized as a brand mismatch against "Nestle Maggi ..." products.
  maggi: "Nestle",
};

const ALL_LOOKUP_TERMS: { term: string; canonical: string }[] = [
  ...CANONICAL_BRANDS.map((b) => ({ term: b, canonical: b })),
  ...Object.entries(BRAND_ALIASES).map(([alias, canonical]) => ({ term: alias, canonical })),
];

export function findKnownBrand(text: string): string | null {
  const lower = text.toLowerCase();
  let best: { term: string; canonical: string } | null = null;
  for (const entry of ALL_LOOKUP_TERMS) {
    if (lower.includes(entry.term.toLowerCase()) && (!best || entry.term.length > best.term.length)) {
      best = entry;
    }
  }
  return best ? best.canonical : null;
}
