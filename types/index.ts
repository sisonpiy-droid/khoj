// Domain types shared across providers, matching, optimization and UI.

export type PlatformId = "blinkit" | "zepto" | "instamart";

export interface GeoLocation {
  pincode: string;
  lat: number;
  lon: number;
}

/** A single product as returned by one platform, mapped into a common shape. */
export interface RawProduct {
  id: string;
  platform: PlatformId;
  name: string;
  brand: string | null;
  /** Raw size/quantity string as given by the platform, e.g. "1 L", "500 g". */
  quantity: string | null;
  price: number | null;
  mrp: number | null;
  available: boolean;
  inventory: number | null;
  imageUrl: string | null;
  /** Real deep link to the product on the platform. Never fabricated. */
  deeplink: string | null;
  /** Delivery ETA in minutes, straight from the provider. Null = not provided. */
  etaMinutes: number | null;
  rating: number | null;
  ratingCount: number | null;
}

export type ProviderErrorCode =
  | "timeout"
  | "auth"
  | "rate_limit"
  | "no_credits"
  | "invalid_location"
  | "upstream_error"
  | "unknown";

export interface ProviderSearchResult {
  platform: PlatformId;
  ok: boolean;
  errorCode?: ProviderErrorCode;
  errorMessage?: string;
  products: RawProduct[];
}

/** Common interface every quick-commerce integration must implement. */
export interface Provider {
  readonly platform: PlatformId;
  search(query: string, location: GeoLocation): Promise<ProviderSearchResult>;
}

// ---- Normalization / matching ----

export type QuantityUnit = "ml" | "g" | "pcs";

export interface NormalizedQuantity {
  /** Value converted to a base unit (ml for volume, g for weight, pcs for count). */
  value: number;
  unit: QuantityUnit;
  /** Human-readable form, e.g. "1 L", "500 g". */
  display: string;
}

export interface NormalizedProduct extends RawProduct {
  normalizedBrand: string | null;
  normalizedQuantity: NormalizedQuantity | null;
  /** Distinguishing variant tags extracted from the name, e.g. ["zero"], ["toned"]. */
  variantTags: string[];
}

/** One matched product line, with the same underlying item found (or not) on each platform. */
export interface MatchedItem {
  /** The search term this line answers, e.g. "milk". */
  query: string;
  /** How many units of this item the user asked for, e.g. "2 packets Maggi" -> 2. */
  count: number;
  /** A representative display name for the matched product group. */
  displayName: string;
  offers: Partial<Record<PlatformId, NormalizedProduct>>;
  /** Platforms queried that returned no matching product. */
  unavailableOn: PlatformId[];
  /** Platforms that errored out entirely for this query. */
  erroredOn: { platform: PlatformId; errorCode?: ProviderErrorCode; errorMessage?: string }[];
}

// ---- Basket optimization ----

export interface PlatformBasketTotal {
  platform: PlatformId;
  /** True only if every requested item is available on this platform. */
  fulfillsFullBasket: boolean;
  total: number | null;
  missingItems: string[];
  /** Max ETA across the items sourced from this platform, if all items report an ETA. */
  etaMinutes: number | null;
}

export interface OptimizedBasketLine {
  query: string;
  displayName: string;
  count: number;
  platform: PlatformId | null;
  /** Price per unit on the chosen platform. */
  price: number | null;
}

export interface BasketOptimization {
  perPlatformTotals: PlatformBasketTotal[];
  fastestPlatform: PlatformId | null;
  optimized: {
    lines: OptimizedBasketLine[];
    total: number | null;
    platformsUsed: PlatformId[];
    /** Items that couldn't be sourced from any platform. */
    unfulfillableItems: string[];
  };
  /** Best total among platforms that can fulfill the whole basket alone, if any. */
  bestSinglePlatformTotal: number | null;
  savings: number | null;
  /** True whenever fees/costs beyond item price are unknown, so totals are estimates only. */
  isEstimate: boolean;
}

export interface SearchApiResponse {
  query: string;
  location: { pincode: string };
  /**
   * One entry per parsed search term, each holding every distinct product
   * found for that term (most relevant first) — item[0] is the single best
   * match, used for basket math; the rest exist so a single-item search can
   * show every matching SKU rather than only the top guess.
   */
  items: MatchedItem[][];
  basket: BasketOptimization | null;
  providerWarnings: { platform: PlatformId; errorCode?: ProviderErrorCode; errorMessage?: string }[];
}
