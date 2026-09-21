import { searchQuickCommerce } from "./quickcommerce";
import type { GeoLocation, Provider, ProviderSearchResult } from "@/types";

export class BlinkitProvider implements Provider {
  readonly platform = "blinkit" as const;

  search(query: string, location: GeoLocation): Promise<ProviderSearchResult> {
    return searchQuickCommerce("blinkit", query, location);
  }
}
