import type {
  BasketOptimization,
  MatchedItem,
  OptimizedBasketLine,
  PlatformBasketTotal,
  PlatformId,
} from "@/types";

const PLATFORMS: PlatformId[] = ["blinkit", "zepto", "instamart"];

function lineCost(item: MatchedItem, platform: PlatformId): number | null {
  const offer = item.offers[platform];
  if (!offer || !offer.available || offer.price === null) return null;
  return offer.price * item.count;
}

function computePlatformTotal(items: MatchedItem[], platform: PlatformId): PlatformBasketTotal {
  const missingItems: string[] = [];
  let total = 0;
  let maxEta: number | null = 0;
  let etaKnown = true;

  for (const item of items) {
    const cost = lineCost(item, platform);
    if (cost === null) {
      missingItems.push(item.displayName);
      continue;
    }
    total += cost;
    const eta = item.offers[platform]?.etaMinutes ?? null;
    if (eta === null) {
      etaKnown = false;
    } else if (maxEta !== null) {
      maxEta = Math.max(maxEta, eta);
    }
  }

  const fulfillsFullBasket = missingItems.length === 0 && items.length > 0;

  return {
    platform,
    fulfillsFullBasket,
    total: fulfillsFullBasket ? total : null,
    missingItems,
    etaMinutes: fulfillsFullBasket && etaKnown ? maxEta : null,
  };
}

function cheapestOffer(item: MatchedItem): { platform: PlatformId; price: number } | null {
  let best: { platform: PlatformId; price: number } | null = null;
  for (const platform of PLATFORMS) {
    const offer = item.offers[platform];
    if (!offer || !offer.available || offer.price === null) continue;
    if (!best || offer.price < best.price) {
      best = { platform, price: offer.price };
    }
  }
  return best;
}

/**
 * Optimizes for lowest realistic total cost given availability, requested
 * quantity and known per-item prices. The QuickCommerce API does not expose
 * delivery/platform/handling fees, so splitting across platforms never
 * accounts for extra delivery charges that a split order could incur — the
 * result is always labeled an estimate rather than a checkout price.
 */
export function optimizeBasket(items: MatchedItem[]): BasketOptimization {
  const perPlatformTotals = PLATFORMS.map((p) => computePlatformTotal(items, p));

  const fulfillingPlatforms = perPlatformTotals.filter((p) => p.fulfillsFullBasket && p.total !== null);
  const bestSinglePlatformTotal =
    fulfillingPlatforms.length > 0 ? Math.min(...fulfillingPlatforms.map((p) => p.total as number)) : null;

  const platformsWithEta = fulfillingPlatforms.filter((p) => p.etaMinutes !== null);
  const fastestPlatform =
    platformsWithEta.length > 0
      ? platformsWithEta.reduce((a, b) => ((a.etaMinutes as number) <= (b.etaMinutes as number) ? a : b)).platform
      : null;

  const lines: OptimizedBasketLine[] = [];
  const unfulfillableItems: string[] = [];
  const platformsUsed = new Set<PlatformId>();
  let optimizedTotal = 0;

  for (const item of items) {
    const best = cheapestOffer(item);
    if (!best) {
      unfulfillableItems.push(item.displayName);
      lines.push({ query: item.query, displayName: item.displayName, count: item.count, platform: null, price: null });
      continue;
    }
    platformsUsed.add(best.platform);
    optimizedTotal += best.price * item.count;
    lines.push({
      query: item.query,
      displayName: item.displayName,
      count: item.count,
      platform: best.platform,
      price: best.price,
    });
  }

  const hasFulfillableItems = lines.some((l) => l.platform !== null);
  const savings =
    bestSinglePlatformTotal !== null && hasFulfillableItems ? bestSinglePlatformTotal - optimizedTotal : null;

  return {
    perPlatformTotals,
    fastestPlatform,
    optimized: {
      lines,
      total: hasFulfillableItems ? optimizedTotal : null,
      platformsUsed: Array.from(platformsUsed),
      unfulfillableItems,
    },
    bestSinglePlatformTotal,
    savings,
    isEstimate: true,
  };
}
