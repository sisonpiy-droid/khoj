// Mock provider used whenever QUICKCOMMERCE_API_KEY is not configured.
// Implements the exact same Provider interface as the real adapters
// (blinkit.ts / zepto.ts / instamart.ts) so the rest of the app — search,
// matching, optimization, UI — cannot tell the difference. Swapping to the
// real QuickCommerce API is a one-line change in ./index.ts.

import { MOCK_LEXICON, type MockCanonicalItem } from "@/data/mockGroceryLexicon";
import type { PlatformId, Provider, ProviderSearchResult, RawProduct } from "@/types";

const PLATFORM_ETA_RANGE: Record<PlatformId, [number, number]> = {
  blinkit: [8, 16],
  zepto: [7, 13],
  instamart: [14, 25],
};

const PLATFORM_SEARCH_URL: Record<PlatformId, (q: string) => string> = {
  blinkit: (q) => `https://blinkit.com/s/?q=${encodeURIComponent(q)}`,
  zepto: (q) => `https://www.zeptonow.com/search?query=${encodeURIComponent(q)}`,
  instamart: (q) => `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodeURIComponent(q)}`,
};

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function quantityDisplay(item: MockCanonicalItem): string {
  if (item.quantityUnit === "ml") {
    return item.quantityValue >= 1000 ? `${item.quantityValue / 1000} L` : `${item.quantityValue} ml`;
  }
  if (item.quantityUnit === "g") {
    return item.quantityValue >= 1000 ? `${item.quantityValue / 1000} kg` : `${item.quantityValue} g`;
  }
  return `${item.quantityValue} pcs`;
}

/** Each platform phrases the same product slightly differently, on purpose —
 * this is exactly the normalization problem the matching layer has to solve. */
function nameFor(platform: PlatformId, item: MockCanonicalItem): string {
  const qty = quantityDisplay(item);
  switch (platform) {
    case "blinkit":
      return `${item.brand} ${item.product} ${qty}`;
    case "zepto":
      return `${item.brand} ${item.product} ${qty}`.replace(" L", "000ml").replace(" kg", "000g");
    case "instamart":
      return `${item.brand} ${item.product} (${qty})`;
  }
}

function findCandidates(term: string): MockCanonicalItem[] {
  const normalized = term.toLowerCase().trim();
  const matches = MOCK_LEXICON.filter((item) =>
    item.keywords.some((kw) => normalized.includes(kw) || kw.includes(normalized))
  );

  // "coke" alone matches both regular and zero — a generic term shouldn't
  // silently collapse to one variant. A specific term ("coke zero") narrows it.
  if (matches.length > 1) {
    const narrowed = matches.filter((item) =>
      item.variantTags.some((tag) => normalized.includes(tag))
    );
    if (narrowed.length > 0) return narrowed;
  }
  return matches;
}

function genericFallback(term: string): MockCanonicalItem {
  const clean = term.trim().replace(/\s+/g, " ");
  const title = clean.replace(/\b\w/g, (c) => c.toUpperCase());
  return {
    id: `generic-${clean.toLowerCase()}`,
    brand: "",
    product: title,
    category: "general",
    quantityValue: 1,
    quantityUnit: "pcs",
    variantTags: [],
    keywords: [clean.toLowerCase()],
    basePrice: 50,
  };
}

function buildProduct(
  platform: PlatformId,
  item: MockCanonicalItem,
  rng: () => number
): RawProduct {
  const priceVariance = 0.9 + rng() * 0.2; // +/-10%
  const price = Math.round(item.basePrice * priceVariance);
  const hasDiscount = rng() > 0.6;
  const mrp = hasDiscount ? Math.round(price * (1 + rng() * 0.12)) : price;
  const available = rng() > 0.08; // ~92% in stock
  const hasEta = rng() > 0.05; // occasionally simulate ETA missing from provider
  const hasImage = rng() > 0.1;
  const [etaMin, etaMax] = PLATFORM_ETA_RANGE[platform];

  const displayName = item.brand ? nameFor(platform, item) : item.product;

  return {
    id: `${platform}-${item.id}`,
    platform,
    name: displayName,
    brand: item.brand || null,
    quantity: item.brand ? quantityDisplay(item) : null,
    price: available ? price : null,
    mrp: available ? mrp : null,
    available,
    inventory: available ? Math.floor(rng() * 30) + 1 : 0,
    imageUrl: hasImage ? `https://picsum.photos/seed/${encodeURIComponent(item.id)}-${platform}/200/200` : null,
    deeplink: PLATFORM_SEARCH_URL[platform](item.brand ? `${item.brand} ${item.product}` : item.product),
    etaMinutes: available && hasEta ? etaMin + Math.floor(rng() * (etaMax - etaMin)) : null,
    rating: Math.round((3.6 + rng() * 1.3) * 10) / 10,
    ratingCount: Math.floor(rng() * 5000) + 20,
  };
}

class MockProvider implements Provider {
  constructor(public readonly platform: PlatformId) {}

  async search(query: string): Promise<ProviderSearchResult> {
    // Simulate realistic network latency so loading states are visible.
    await new Promise((r) => setTimeout(r, 250 + Math.random() * 350));

    const candidates = findCandidates(query);
    const items = candidates.length > 0 ? candidates : [genericFallback(query)];

    const products = items.map((item) => {
      const rng = mulberry32(hashString(`${this.platform}:${item.id}`));
      return buildProduct(this.platform, item, rng);
    });

    return { platform: this.platform, ok: true, products };
  }
}

export function createMockProvider(platform: PlatformId): Provider {
  return new MockProvider(platform);
}
