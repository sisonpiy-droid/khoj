import { findKnownBrand } from "@/data/knownBrands";
import { HARD_VARIANT_KEYWORDS, coreTokens, isMultipackQuantity, normalizeProduct, parseQuantity } from "./normalize";
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

/** Real catalogues label the same manufacturer differently across platforms
 * — e.g. "Nandini" vs "Nandini Goodlife" (a specific product line under the
 * same dairy cooperative brand). Requiring exact string equality here
 * wrongly treated every platform's own sub-brand phrasing as a different
 * manufacturer, which is why cross-platform matches for common items like
 * plain "milk" were collapsing to a single platform. A containment check
 * accepts genuine sub-brand naming while still rejecting unrelated brands
 * (e.g. "Nandini" is not a substring of "Godrej Jersey"). */
function brandsCompatible(a: string, b: string): boolean {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  return la === lb || la.includes(lb) || lb.includes(la);
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
    if (!brandsCompatible(a.normalizedBrand, b.normalizedBrand)) return false;
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
    score += brandsCompatible(queryBrand, product.normalizedBrand) ? 2 : -1;
  }

  const qtyMatch = sameQuantity(queryQuantity, product.normalizedQuantity);
  if (qtyMatch === true) score += 2;
  if (qtyMatch === false) score -= 3; // e.g. query asked for 1L, this is 500ml

  if (product.available) score += 0.1;
  // A generic query ("milk") means a single retail unit by default. Without
  // this, ties between a platform's single-pack and multipack listings of
  // the exact same item resolve arbitrarily (by array order), which could
  // pick a 4-pack over another platform's single pack and then correctly —
  // but confusingly — report them as not matching on quantity.
  if (isMultipackQuantity(product.quantity)) score -= 0.5;

  return score;
}

// How many of a platform's own results to consider per search term. A
// generic query ("milk") can have dozens of relevant results on one
// platform alone; capping this bounds clustering cost without meaningfully
// limiting what a real shopper would actually scroll through.
const MAX_CANDIDATES_PER_PLATFORM = 8;
// Safety bound on how many distinct products we ever return for one term,
// so a very generic query can't return an unbounded page.
const MAX_PRODUCT_GROUPS = 25;

/**
 * Finds every distinct real-world product matching a search term, each
 * compared across whichever platforms actually carry it. Considers each
 * platform's own top-scoring candidates (not just its single best result),
 * then clusters candidates that are genuinely the same product — a specific
 * search like "Amul Taaza 1L" naturally narrows to one dominant product,
 * while a generic term like "milk" surfaces every distinct SKU platforms
 * have on offer, most relevant first.
 */
export function matchProducts(term: string, count: number, results: ProviderSearchResult[]): MatchedItem[] {
  const queryTokens = tokenize(term);
  const queryQuantity = parseQuantity(null, term);
  const queryBrand = findKnownBrand(term);

  const erroredOn: MatchedItem["erroredOn"] = [];
  const successfulPlatforms: PlatformId[] = [];
  const allCandidates: ScoredCandidate[] = [];

  for (const result of results) {
    if (!result.ok) {
      erroredOn.push({
        platform: result.platform,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      });
      continue;
    }
    successfulPlatforms.push(result.platform);

    const scored = result.products
      .map(normalizeProduct)
      .map((product): ScoredCandidate => ({
        platform: result.platform,
        product,
        score: scoreCandidate(product, queryTokens, queryQuantity, queryBrand),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_CANDIDATES_PER_PLATFORM);

    allCandidates.push(...scored);
  }

  // Cluster candidates that are genuinely the same product. A candidate must
  // match every existing member of a cluster (not just the first one added)
  // so loosely-transitive chains can't merge products that aren't actually
  // equivalent to each other.
  const clusters: ScoredCandidate[][] = [];
  for (const candidate of allCandidates) {
    const cluster = clusters.find((c) => c.every((member) => isEquivalent(member.product, candidate.product)));
    if (cluster) {
      // Same platform can legitimately appear twice in a cluster only if
      // the provider listed a near-duplicate; keep the better-scoring one.
      const existingIndex = cluster.findIndex((m) => m.platform === candidate.platform);
      if (existingIndex === -1) cluster.push(candidate);
      else if (candidate.score > cluster[existingIndex].score) cluster[existingIndex] = candidate;
    } else {
      clusters.push([candidate]);
    }
  }

  if (clusters.length === 0) {
    // Nothing relevant found anywhere — one honest "not found" row rather
    // than an empty result set the UI would have to special-case.
    return [
      {
        query: term,
        count,
        displayName: term,
        offers: {},
        unavailableOn: successfulPlatforms,
        erroredOn,
      },
    ];
  }

  clusters.sort((a, b) => {
    const platformsA = new Set(a.map((c) => c.platform)).size;
    const platformsB = new Set(b.map((c) => c.platform)).size;
    if (platformsB !== platformsA) return platformsB - platformsA;
    const bestA = Math.max(...a.map((c) => c.score));
    const bestB = Math.max(...b.map((c) => c.score));
    return bestB - bestA;
  });

  return clusters.slice(0, MAX_PRODUCT_GROUPS).map((cluster) => {
    const clusterPlatforms = new Set(cluster.map((c) => c.platform));
    const offers: MatchedItem["offers"] = {};
    for (const c of cluster) offers[c.platform] = c.product;

    const unavailableOn = successfulPlatforms.filter((p) => !clusterPlatforms.has(p));
    const anchor = [...cluster].sort((a, b) => b.score - a.score)[0];

    return {
      query: term,
      count,
      displayName: anchor.product.name,
      offers,
      unavailableOn,
      erroredOn,
    };
  });
}
