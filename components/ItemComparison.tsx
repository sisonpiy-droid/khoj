import { OfferCard } from "./OfferCard";
import { PLATFORM_ORDER } from "./platformMeta";
import type { MatchedItem, PlatformId } from "@/types";

export function ItemComparison({ item }: { item: MatchedItem }) {
  const availableOffers = PLATFORM_ORDER.map((p) => item.offers[p]).filter(
    (o) => o && o.available && o.price !== null
  );

  const cheapestPrice =
    availableOffers.length > 0 ? Math.min(...availableOffers.map((o) => o!.price as number)) : null;

  const offersWithEta = availableOffers.filter((o) => o!.etaMinutes !== null);
  const fastestEta =
    offersWithEta.length > 0 ? Math.min(...offersWithEta.map((o) => o!.etaMinutes as number)) : null;

  const errorMap = new Map(item.erroredOn.map((e) => [e.platform, e]));

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold text-zinc-900">
        {item.displayName}
        {item.count > 1 && <span className="ml-2 text-sm font-medium text-zinc-400">x{item.count}</span>}
      </h3>
      <div className="flex flex-wrap gap-3">
        {PLATFORM_ORDER.map((platform: PlatformId) => {
          const offer = item.offers[platform];
          if (offer) {
            return (
              <OfferCard
                key={platform}
                platform={platform}
                offer={offer}
                status="ok"
                isCheapest={offer.available && offer.price === cheapestPrice && cheapestPrice !== null}
                isFastest={offer.etaMinutes !== null && offer.etaMinutes === fastestEta}
              />
            );
          }
          const error = errorMap.get(platform);
          if (error) {
            return (
              <OfferCard
                key={platform}
                platform={platform}
                status="error"
                errorCode={error.errorCode}
                errorMessage={error.errorMessage}
              />
            );
          }
          return <OfferCard key={platform} platform={platform} status="no-match" />;
        })}
      </div>
    </div>
  );
}
