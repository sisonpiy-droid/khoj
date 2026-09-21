import { PLATFORM_META } from "./platformMeta";
import type { BasketOptimization, MatchedItem } from "@/types";

export function BasketSummary({
  items,
  basket,
}: {
  items: MatchedItem[];
  basket: BasketOptimization;
}) {
  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-zinc-200 bg-zinc-50 p-6">
      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Your basket</h2>
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((item) => {
            const line = basket.optimized.lines.find((l) => l.query === item.query);
            return (
              <li key={item.query} className="flex items-center justify-between text-sm">
                <span className="text-zinc-700">
                  {item.displayName}
                  {item.count > 1 ? ` x${item.count}` : ""}
                </span>
                {line?.platform && line.price !== null ? (
                  <span className="font-medium text-zinc-900">
                    Best: {PLATFORM_META[line.platform].label} ₹{line.price * item.count}
                  </span>
                ) : (
                  <span className="font-medium text-red-500">Not available anywhere</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {basket.perPlatformTotals.map((pt) => (
          <div key={pt.platform} className="rounded-2xl border border-zinc-200 bg-white p-4">
            <div className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${PLATFORM_META[pt.platform].bg} ${PLATFORM_META[pt.platform].text}`}>
              {PLATFORM_META[pt.platform].label}
            </div>
            <div className="mt-2 text-xl font-bold text-zinc-900">
              {pt.fulfillsFullBasket ? `₹${pt.total}` : "—"}
            </div>
            <div className="text-xs text-zinc-400">
              {pt.fulfillsFullBasket
                ? pt.etaMinutes !== null
                  ? `${pt.etaMinutes} min`
                  : "ETA unavailable"
                : `Missing ${pt.missingItems.length} item${pt.missingItems.length === 1 ? "" : "s"}`}
            </div>
          </div>
        ))}

        <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 p-4">
          <div className="inline-block rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-semibold text-white">
            Optimized
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-800">
            {basket.optimized.total !== null ? `₹${basket.optimized.total}` : "—"}
          </div>
          <div className="text-xs text-emerald-700">
            {basket.optimized.platformsUsed.length > 0
              ? `Split across ${basket.optimized.platformsUsed.length} platform${
                  basket.optimized.platformsUsed.length === 1 ? "" : "s"
                }`
              : "No fulfillable items"}
          </div>
        </div>
      </div>

      {basket.savings !== null && basket.savings > 0 && (
        <div className="rounded-2xl bg-emerald-600 px-5 py-4 text-white">
          <div className="text-sm font-medium text-emerald-100">Potential saving vs. the best single-platform order</div>
          <div className="text-3xl font-extrabold">₹{basket.savings}</div>
        </div>
      )}

      {basket.savings === 0 && (
        <div className="rounded-2xl bg-zinc-100 px-5 py-3 text-sm text-zinc-600">
          The cheapest single platform already matches the optimized split — no extra savings from splitting.
        </div>
      )}

      {basket.bestSinglePlatformTotal === null && (
        <div className="rounded-2xl bg-amber-50 px-5 py-3 text-sm text-amber-700">
          No single platform has every item in this basket, so there&apos;s no one-platform total to compare against.
        </div>
      )}

      {basket.optimized.unfulfillableItems.length > 0 && (
        <div className="rounded-2xl bg-red-50 px-5 py-3 text-sm text-red-600">
          Couldn&apos;t find: {basket.optimized.unfulfillableItems.join(", ")}
        </div>
      )}

      {basket.isEstimate && (
        <p className="text-xs text-zinc-400">
          Estimate based on item prices only — delivery, platform and handling fees aren&apos;t exposed by the
          data source and are not included. Actual checkout totals may differ.
        </p>
      )}
    </div>
  );
}
