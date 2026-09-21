// Shared client for the QuickCommerce API (https://quickcommerceapi.com/docs).
//
// This talks to the real, documented API. It is NOT used unless
// QUICKCOMMERCE_API_KEY is set — see ./index.ts for the mock/real switch.
// Response shapes below match the documented /v1/search schema:
//   { status, request_id, credits_remaining, data: { products: [...] } }
// with each product having: id, name, brand, available, images[], mrp,
// offer_price, quantity, deeplink, rating, rating_count, inventory,
// platform: { name, sla, open, icon }.

import { withCache } from "@/lib/cache";
import type { GeoLocation, PlatformId, ProviderErrorCode, ProviderSearchResult, RawProduct } from "@/types";

const BASE_URL = "https://api.quickcommerceapi.com";
const SEARCH_TTL_MS = 45_000; // prices/inventory move fast; only guards against duplicate bursts
// Measured against the live API: most platforms respond in 1-6s, but
// Instamart in particular has been observed taking 6s on one call and
// timing out past 20s on the next for the identical query (likely live
// upstream scraping rather than a cached DB). 8s was cutting off searches
// that would have succeeded a couple seconds later; 18s trades a slightly
// slower worst case for far fewer false "timed out" results.
const FETCH_TIMEOUT_MS = 18_000;

const PLATFORM_PARAM: Record<PlatformId, string> = {
  blinkit: "BlinkIt",
  zepto: "Zepto",
  instamart: "Swiggy",
};

interface QuickCommerceProductDTO {
  id: string;
  name: string;
  brand: string | null;
  available: boolean;
  images?: string[];
  mrp: number | null;
  offer_price: number | null;
  quantity: string | null;
  deeplink: string | null;
  rating: number | null;
  rating_count: number | null;
  inventory: number | null;
  platform?: { name: string; sla?: string | null; open?: boolean };
}

function parseSlaMinutes(sla: string | null | undefined): number | null {
  if (!sla) return null;
  const match = sla.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function mapProduct(dto: QuickCommerceProductDTO, platform: PlatformId): RawProduct {
  return {
    id: dto.id,
    platform,
    name: dto.name,
    brand: dto.brand,
    quantity: dto.quantity,
    price: dto.offer_price ?? null,
    mrp: dto.mrp ?? null,
    available: dto.available,
    inventory: dto.inventory ?? null,
    imageUrl: dto.images?.[0] ?? null,
    deeplink: dto.deeplink,
    etaMinutes: parseSlaMinutes(dto.platform?.sla),
    rating: dto.rating,
    ratingCount: dto.rating_count,
  };
}

function classifyHttpError(status: number): ProviderErrorCode {
  if (status === 401) return "auth";
  if (status === 402) return "no_credits";
  if (status === 404) return "invalid_location";
  if (status === 429) return "rate_limit";
  if (status === 504) return "timeout";
  return "upstream_error";
}

async function fetchWithTimeout(url: string, apiKey: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "X-API-Key": apiKey },
      signal: controller.signal,
      // Search results go stale fast; let our own short-TTL cache handle reuse.
      cache: "no-store",
    });
  } finally {
    clearTimeout(timer);
  }
}

export async function searchQuickCommerce(
  platform: PlatformId,
  query: string,
  location: GeoLocation
): Promise<ProviderSearchResult> {
  const apiKey = process.env.QUICKCOMMERCE_API_KEY;
  if (!apiKey) {
    return {
      platform,
      ok: false,
      errorCode: "auth",
      errorMessage: "QUICKCOMMERCE_API_KEY is not configured.",
      products: [],
    };
  }

  const roundedLat = location.lat.toFixed(3);
  const roundedLon = location.lon.toFixed(3);
  const cacheKey = `qc:${platform}:${query.toLowerCase().trim()}:${roundedLat}:${roundedLon}`;

  return withCache(cacheKey, SEARCH_TTL_MS, async (): Promise<ProviderSearchResult> => {
    const params = new URLSearchParams({
      q: query,
      lat: String(location.lat),
      lon: String(location.lon),
      platform: PLATFORM_PARAM[platform],
    });

    try {
      const res = await fetchWithTimeout(`${BASE_URL}/v1/search?${params.toString()}`, apiKey);

      if (!res.ok) {
        return {
          platform,
          ok: false,
          errorCode: classifyHttpError(res.status),
          errorMessage: `QuickCommerce API returned ${res.status}`,
          products: [],
        };
      }

      const body = await res.json();
      const products: QuickCommerceProductDTO[] = body?.data?.products ?? [];
      return {
        platform,
        ok: true,
        products: products.map((p) => mapProduct(p, platform)),
      };
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "AbortError";
      return {
        platform,
        ok: false,
        errorCode: timedOut ? "timeout" : "unknown",
        errorMessage: timedOut ? "Request to QuickCommerce API timed out." : "Unexpected error calling QuickCommerce API.",
        products: [],
      };
    }
  });
}
