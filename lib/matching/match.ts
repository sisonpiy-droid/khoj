import { findKnownBrand } from "@/data/knownBrands";
import { HARD_VARIANT_KEYWORDS, coreTokens, normalizeProduct, parseQuantity } from "./normalize";
import type {
  MatchedItem,
  NormalizedProduct,
  NormalizedQuantity,
  PlatformId,
  ProviderSearchResult,
} from "@/types";

const STOPWORDS = new Set(["the", "of", "a", "an", "with", "for", "please", "some"]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function sameQuantity(a: NormalizedQuantity | null, b: NormalizedQuantity | null): boolean | null {
  if (!a || !b) return null; // unknown, not a hard mismatch
  if (a.unit !== b.unit) return false;
  return Math.abs(a.value - b.value) < 0.001 * Math.max(a.value, b.value, 1);
}

/** Hard variants (zero/diet/etc.) must match exactly — never merge Coke with
 * Coke Zero. Soft variants (toned/full cream/etc.) only block a match when
 * both sides specify a conflicting descriptor; one side omitting it (the
 * common real-world case) is treated as the same default product. */
function sameVariants(a: string[], b: string[]): boolean {
  const hardA = a.filter((t) => HARD_VARIANT_KEYWORDS.has(t));
  const hardB = b.filter((t) => HARD_VARIANT_KEYWORDS.has(t));
  if (hardA.length !== hardB.length || !hardA.every((t) => hardB.includes(t))) return false;

  const softA = a.filter((t) => !HARD_VARIANT_KEYWORDS.has(t));
  const softB = b.filter((t) => !HARD_VARIANT_KEYWORDS.has(t));
  if (softA.length > 0 && softB.length > 0 && !softA.some((t) => softB.includes(t))) return false;

  return true;
}

/** Two products are the same real-world item only if brand, quantity and
 * variant all agree (a 500ml pack is never the same as a 1L pack; regular
 * Coke is never the same as Coke Zero), plus some descriptive word overlap
 * as a sanity check against coincidental brand+size matches. */
function isEquivalent(a: NormalizedProduct, b: NormalizedProduct): boolean {
  if (!sameVariants(a.variantTags, b.variantTags)) return false;

  const qtyMatch = sameQuantity(a.normalizedQuantity, b.normalizedQuantity);
  if (qtyMatch === false) return false;

  if (a.normalizedBrand && b.normalizedBrand) {
    if (a.normalizedBrand.toLowerCase() !== b.normalizedBrand.toLowerCase()) return false;
  }

  const similarity = jaccard(coreTokens(a), coreTokens(b));
  if (coreTokens(a).size > 0 && coreTokens(b).size > 0 && similarity < 0.3) return false;

  return true;
}

interface ScoredCandidate {
  platform: PlatformId;
  product: NormalizedProduct;
  score: number;
}

function scoreCandidate(
  product: NormalizedProduct,
  queryTokens: Set<string>,
  queryQuantity: NormalizedQuantity | null,
  queryBrand: string | null
): number {
  let score = jaccard(coreTokens(product), queryTokens) * 3;

  if (queryBrand && product.normalizedBrand) {
    score += queryBrand.toLowerCase() === product.normalizedBrand.toLowerCase() ? 2 : -1;
  }

  const qtyMatch = sameQuantity(queryQuantity, product.normalizedQuantity);
  if (qtyMatch === true) score += 2;
  if (qtyMatch === false) score -= 3; // e.g. query asked for 1L, this is 500ml

  if (product.available) score += 0.1;

  return score;
}

/** Picks the best-matching product per platform for one search term, then
 * clusters the per-platform picks into a single equivalence group so only
 * genuinely-the-same products are compared side by side. */
export function matchAcrossPlatforms(
  term: string,
  count: number,
  results: ProviderSearchResult[]
): MatchedItem {
  const queryTokens = tokenize(term);
  const queryQuantity = parseQuantity(null, term);
  const queryBrand = findKnownBrand(term);

  const erroredOn: MatchedItem["erroredOn"] = [];
  const candidatesByPlatform: Partial<Record<PlatformId, ScoredCandidate>> = {};
  const noMatchPlatforms: PlatformId[] = [];

  for (const result of results) {
    if (!result.ok) {
      erroredOn.push({
        platform: result.platform,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
      continue;
    }

    const normalized = result.products.map(normalizeProduct);
    let best: ScoredCandidate | null = null;
    for (const product of normalized) {
      const score = scoreCandidate(product, queryTokens, queryQuantity, queryBrand);
      if (!best || score > best.score) {
        best = { platform: result.platform, product, score };
      }
    }

    if (best && best.score > 0) {
      candidatesByPlatform[result.platform] = best;
    } else {
      noMatchPlatforms.push(result.platform);
    }
  }

  const candidates = Object.values(candidatesByPlatform) as ScoredCandidate[];

  // Cluster candidates that are genuinely the same product.
  const clusters: ScoredCandidate[][] = [];
  for (const candidate of candidates) {
    const cluster = clusters.find((c) => isEquivalent(c[0].product, candidate.product));
    if (cluster) cluster.push(candidate);
    else clusters.push([candidate]);
  }

  clusters.sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length;
    const bestA = Math.max(...a.map((c) => c.score));
    const bestB = Math.max(...b.map((c) => c.score));
    return bestB - bestA;
  });

  const winningCluster = clusters[0] ?? [];
  const winningPlatforms = new Set(winningCluster.map((c) => c.platform));

  const offers: MatchedItem["offers"] = {};
  for (const c of winningCluster) {
    offers[c.platform] = c.product;
  }

  const unavailableOn: PlatformId[] = [
    ...noMatchPlatforms,
    ...candidates.filter((c) => !winningPlatforms.has(c.platform)).map((c) => c.platform),
  ];

  const anchor = winningCluster.sort((a, b) => b.score - a.score)[0];

  return {
    query: term,
    count,
    displayName: anchor ? anchor.product.name : term,
    offers,
    unavailableOn,
    erroredOn,
  };
}
