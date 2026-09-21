import { searchQuickCommerce } from "./quickcommerce";
import type { GeoLocation, Provider, ProviderSearchResult } from "@/types";

export class ZeptoProvider implements Provider {
  readonly platform = "zepto" as const;

  search(query: string, location: GeoLocation): Promise<ProviderSearchResult> {
    return searchQuickCommerce("zepto", query, location);
  }
}
