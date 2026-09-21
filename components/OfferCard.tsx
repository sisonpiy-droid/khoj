import { PLATFORM_META } from "./platformMeta";
import type { NormalizedProduct, PlatformId, ProviderErrorCode } from "@/types";

interface OfferCardProps {
  platform: PlatformId;
  offer?: NormalizedProduct;
  isCheapest?: boolean;
  isFastest?: boolean;
  status: "ok" | "no-match" | "error";
  errorCode?: ProviderErrorCode;
  errorMessage?: string;
}

const ERROR_LABEL: Partial<Record<ProviderErrorCode, string>> = {
  timeout: "Timed out",
  auth: "Unavailable",
  rate_limit: "Busy right now",
  no_credits: "Unavailable",
  invalid_location: "Not serviceable here",
  upstream_error: "Unavailable",
  unknown: "Unavailable",
};

export function OfferCard({ platform, offer, isCheapest, isFastest, status, errorCode }: OfferCardProps) {
  const meta = PLATFORM_META[platform];

  return (
    <div
      className={`relative flex flex-1 min-w-[150px] flex-col gap-2 rounded-2xl border p-4 ${
        isCheapest ? "border-emerald-400 ring-2 ring-emerald-300" : "border-zinc-200"
      } bg-white`}
    >
      <div className="flex items-center justify-between">
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${meta.bg} ${meta.text}`}>
          {meta.label}
        </span>
        <div className="flex gap-1">
          {isCheapest && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Cheapest
            </span>
          )}
          {isFastest && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
              Fastest
            </span>
          )}
        </div>
      </div>

      {status === "error" && (
        <div className="flex flex-1 flex-col items-start justify-center gap-1 py-3">
          <span className="text-sm font-medium text-zinc-400">{ERROR_LABEL[errorCode ?? "unknown"]}</span>
        </div>
      )}

      {status === "no-match" && (
        <div className="flex flex-1 flex-col items-start justify-center gap-1 py-3">
          <span className="text-sm font-medium text-zinc-400">Not found</span>
        </div>
      )}

      {status === "ok" && offer && (
        <>
          <div className="flex items-baseline gap-2">
            {offer.available && offer.price !== null ? (
              <>
                <span className="text-2xl font-bold text-zinc-900">₹{offer.price}</span>
                {offer.mrp !== null && offer.mrp > offer.price && (
                  <span className="text-sm text-zinc-400 line-through">₹{offer.mrp}</span>
                )}
              </>
            ) : (
              <span className="text-sm font-semibold text-red-500">Out of stock</span>
            )}
          </div>

          <div className="text-sm text-zinc-500">
            {offer.etaMinutes !== null ? `${offer.etaMinutes} min` : "ETA unavailable"}
          </div>

          {offer.quantity && <div className="text-xs text-zinc-400">{offer.quantity}</div>}

          {offer.deeplink && (
            <a
              href={offer.deeplink}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-auto inline-flex items-center justify-center rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50"
            >
              View on {meta.label}
            </a>
          )}
        </>
      )}
    </div>
  );
}
