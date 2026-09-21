import { NextRequest, NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";
import { resolvePincode } from "@/lib/location";
import { parseQuery } from "@/lib/search/parseQuery";
import { matchProducts } from "@/lib/matching/match";
import { optimizeBasket } from "@/lib/optimization/basket";
import type { MatchedItem, ProviderErrorCode, SearchApiResponse } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();
  const pincode = (searchParams.get("pincode") || "").trim();

  if (!query) {
    return NextResponse.json({ error: "Enter something to search for." }, { status: 400 });
  }
  if (!pincode) {
    return NextResponse.json({ error: "Enter a pincode so we can check local availability." }, { status: 400 });
  }

  const locationResult = await resolvePincode(pincode);
  if (!locationResult.ok) {
    return NextResponse.json({ error: locationResult.error }, { status: 400 });
  }
  const location = locationResult.location;

  const parsedItems = parseQuery(query);
  if (parsedItems.length === 0) {
    return NextResponse.json({ error: "Couldn't understand that search." }, { status: 400 });
  }

  const providers = getProviders();

  const items: MatchedItem[][] = await Promise.all(
    parsedItems.map(async (parsed) => {
      const results = await Promise.all(
        providers.map((provider) => provider.search(parsed.term, location))
      );
      return matchProducts(parsed.term, parsed.count, results);
    })
  );

  const warningMap = new Map<
    string,
    { platform: string; errorCode?: ProviderErrorCode; errorMessage?: string }
  >();
  for (const group of items) {
    for (const err of group[0].erroredOn) {
      warningMap.set(err.platform, err);
    }
  }

  // Basket math needs exactly one product per requested item — the best
  // match for each term, same as a single-item search's top result.
  const primaryItems = items.map((group) => group[0]);
  const basket = primaryItems.length > 1 ? optimizeBasket(primaryItems) : null;

  const response: SearchApiResponse = {
    query,
    location: { pincode },
    items,
    basket,
    providerWarnings: Array.from(warningMap.values()) as SearchApiResponse["providerWarnings"],
  };

  return NextResponse.json(response);
}
