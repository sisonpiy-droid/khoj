import { searchQuickCommerce } from "./quickcommerce";
import type { GeoLocation, Provider, ProviderSearchResult } from "@/types";

export class InstamartProvider implements Provider {
  readonly platform = "instamart" as const;

  search(query: string, location: GeoLocation): Promise<ProviderSearchResult> {
    return searchQuickCommerce("instamart", query, location);
  }
}
